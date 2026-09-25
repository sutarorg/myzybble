-- Zybble — 0010: core business logic in the database
--
-- Keeping quota accounting, job claiming and deduplication in Postgres means
-- the same guarantees hold for the Next.js server, the Railway worker and any
-- future consumer.

-- ---------------------------------------------------------------------------
-- Billing period helpers
-- ---------------------------------------------------------------------------

create or replace function public.period_start(ts timestamptz default now())
returns date
language sql
immutable
as $$ select date_trunc('month', coalesce(ts, now()) at time zone 'UTC')::date $$;

create or replace function public.period_end(p_start date)
returns date
language sql
immutable
as $$ select (p_start + interval '1 month')::date $$;

-- ---------------------------------------------------------------------------
-- Usage accounting
--
-- A *billable lead* is one unique lead successfully persisted for a workspace
-- in the period. Duplicate detections are counted in scrape_jobs.duplicates but
-- never here (§10).
-- ---------------------------------------------------------------------------

create or replace function public.ensure_usage_row(p_workspace uuid, p_period date)
returns public.usage
language plpgsql
as $$
declare
  v_row public.usage;
  v_limit integer;
begin
  select u.* into v_row from public.usage u
   where u.workspace_id = p_workspace and u.period_start = p_period
   for update;

  if v_row.id is null then
    select coalesce(p.monthly_leads, 100) into v_limit
      from public.workspaces w
      left join public.plans p on p.id = w.plan_id
     where w.id = p_workspace;

    insert into public.usage (workspace_id, period_start, period_end, leads_limit)
    values (p_workspace, p_period, public.period_end(p_period), coalesce(v_limit, 100))
    on conflict (workspace_id, period_start) do nothing
    returning * into v_row;

    if v_row.id is null then
      select u.* into v_row from public.usage u
       where u.workspace_id = p_workspace and u.period_start = p_period;
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.record_usage(
  p_workspace uuid,
  p_metric text,
  p_delta integer,
  p_idempotency_key text,
  p_user_id uuid default null,
  p_lead_id uuid default null,
  p_job_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (counted boolean, leads_used bigint, leads_limit integer, leads_remaining bigint)
language plpgsql
as $$
declare
  v_period date := public.period_start();
  v_row    public.usage;
  v_inserted boolean := false;
begin
  if p_delta = 0 then
    return query select false, 0::bigint, 0, 0::bigint;
    return;
  end if;

  -- Idempotency: a repeated event (retry, replay) is silently ignored.
  insert into public.usage_events (
    workspace_id, user_id, metric, delta, idempotency_key,
    period_start, lead_id, scrape_job_id, metadata
  )
  values (
    p_workspace, p_user_id, p_metric, p_delta, p_idempotency_key,
    v_period, p_lead_id, p_job_id, p_metadata
  )
  on conflict (workspace_id, idempotency_key) do nothing
  returning true into v_inserted;

  if v_inserted is distinct from true then
    select u.* into v_row from public.usage u
     where u.workspace_id = p_workspace and u.period_start = v_period;
    return query select
      false,
      coalesce(v_row.leads_used, 0),
      coalesce(v_row.leads_limit, 100),
      greatest(coalesce(v_row.leads_limit, 100) - coalesce(v_row.leads_used, 0), 0);
    return;
  end if;

  v_row := public.ensure_usage_row(p_workspace, v_period);

  update public.usage u
     set leads_used   = u.leads_used   + case when p_metric = 'leads'       then p_delta else 0 end,
         searches_run = u.searches_run + case when p_metric = 'searches'    then p_delta else 0 end,
         exports_run  = u.exports_run  + case when p_metric = 'exports'     then p_delta else 0 end,
         ai_requests  = u.ai_requests  + case when p_metric = 'ai_requests' then p_delta else 0 end,
         emails_sent  = u.emails_sent  + case when p_metric = 'emails_sent' then p_delta else 0 end,
         updated_at   = now()
   where u.id = v_row.id
  returning * into v_row;

  return query select
    true,
    v_row.leads_used,
    v_row.leads_limit,
    greatest(v_row.leads_limit - v_row.leads_used, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Entitlements
-- ---------------------------------------------------------------------------

create or replace function public.recompute_entitlements(p_workspace uuid)
returns public.entitlements
language plpgsql
as $$
declare
  v_plan   public.plans;
  v_sub    public.subscriptions;
  v_row    public.usage;
  v_period date := public.period_start();
  v_ent    public.entitlements;
begin
  select s.* into v_sub
    from public.subscriptions s
   where s.workspace_id = p_workspace
   order by
     case s.status when 'active' then 0 when 'trialing' then 1 when 'past_due' then 2
                   when 'paused' then 3 when 'incomplete' then 4 when 'cancelled' then 5 else 6 end,
     s.created_at desc
   limit 1;

  if v_sub.plan_id is not null then
    select p.* into v_plan from public.plans p where p.id = v_sub.plan_id;
  end if;

  if v_plan.id is null then
    select p.* into v_plan from public.plans p
     where p.code = 'free' and p.is_active
     order by p.sort_order limit 1;
  end if;

  v_row := public.ensure_usage_row(p_workspace, v_period);

  -- Keep the usage row's limit aligned with the plan (handles upgrades).
  update public.usage u
     set leads_limit = coalesce(v_plan.monthly_leads, 100)
   where u.id = v_row.id and u.leads_limit <> coalesce(v_plan.monthly_leads, 100)
  returning * into v_row;

  insert into public.entitlements as e (
    workspace_id, plan_code, plan_name, monthly_leads, leads_used, leads_remaining,
    status, has_email_data, has_phone_data, has_csv_export, has_ai_assistant,
    has_campaigns, max_seats, period_start, period_end, cancel_at_period_end, computed_at
  )
  values (
    p_workspace,
    coalesce(v_plan.code, 'free'),
    coalesce(v_plan.name, 'Free'),
    coalesce(v_plan.monthly_leads, 100),
    v_row.leads_used,
    greatest(coalesce(v_plan.monthly_leads, 100) - v_row.leads_used, 0),
    coalesce(v_sub.status, 'active'::public.subscription_status),
    coalesce((v_plan.features ->> 'email_data')::boolean, true),
    coalesce((v_plan.features ->> 'phone_data')::boolean, true),
    coalesce((v_plan.features ->> 'csv_export')::boolean, true),
    coalesce((v_plan.features ->> 'ai_assistant')::boolean, true),
    coalesce((v_plan.features ->> 'campaigns')::boolean, true),
    1,
    v_period,
    public.period_end(v_period),
    coalesce(v_sub.cancel_at_period_end, false),
    now()
  )
  on conflict (workspace_id) do update set
    plan_code = excluded.plan_code,
    plan_name = excluded.plan_name,
    monthly_leads = excluded.monthly_leads,
    leads_used = excluded.leads_used,
    leads_remaining = excluded.leads_remaining,
    status = excluded.status,
    has_email_data = excluded.has_email_data,
    has_phone_data = excluded.has_phone_data,
    has_csv_export = excluded.has_csv_export,
    has_ai_assistant = excluded.has_ai_assistant,
    has_campaigns = excluded.has_campaigns,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    computed_at = now(),
    updated_at = now()
  returning * into v_ent;

  update public.workspaces w set plan_id = v_plan.id where w.id = p_workspace;

  return v_ent;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scrape job queue
-- ---------------------------------------------------------------------------

create or replace function public.claim_scrape_job(
  p_worker_id text,
  p_lease_seconds integer default 120,
  p_engine_version text default null
)
returns public.scrape_jobs
language plpgsql
as $$
declare
  v_job public.scrape_jobs;
begin
  -- Atomically claim the oldest queued job. SKIP LOCKED means concurrent
  -- workers never block or double-claim (§5).
  select j.* into v_job
    from public.scrape_jobs j
   where j.status = 'queued'
     and j.cancel_requested = false
   order by j.created_at
   for update skip locked
   limit 1;

  if v_job.id is null then
    return null;
  end if;

  update public.scrape_jobs j
     set status = 'starting',
         worker_id = p_worker_id,
         claimed_at = now(),
         heartbeat_at = now(),
         lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
         attempts = j.attempts + 1,
         started_at = coalesce(j.started_at, now()),
         engine_version = coalesce(p_engine_version, j.engine_version),
         updated_at = now()
   where j.id = v_job.id
  returning * into v_job;

  insert into public.scrape_job_events (job_id, workspace_id, event, status, worker_id)
  values (v_job.id, v_job.workspace_id, 'job.claimed', v_job.status, p_worker_id);

  return v_job;
end;
$$;

create or replace function public.heartbeat_scrape_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
as $$
declare
  v_ok boolean := false;
  v_cancel boolean := false;
  v_pause boolean := false;
begin
  update public.scrape_jobs j
     set heartbeat_at = now(),
         lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
         updated_at = now()
   where j.id = p_job_id
     and j.worker_id = p_worker_id
     and j.status in ('starting', 'running')
  returning true, j.cancel_requested, j.pause_requested
    into v_ok, v_cancel, v_pause;

  if v_cancel then
    -- Cooperatively transition to cancelling; the worker finishes the batch.
    update public.scrape_jobs set status = 'cancelling' where id = p_job_id and status in ('starting', 'running');
  elsif v_pause then
    update public.scrape_jobs set status = 'paused', pause_requested = false
     where id = p_job_id and status in ('starting', 'running');
  end if;

  return coalesce(v_ok, false);
end;
$$;

/**
 * Recovery sweep. Any job in a non-terminal state whose lease has expired (or
 * whose worker died) goes back to `queued` so it can be retried. Guarantees no
 * job is permanently stuck in `running` (§31).
 */
create or replace function public.requeue_orphaned_jobs(p_limit integer default 100)
returns setof uuid
language plpgsql
as $$
begin
  return query
  with orphaned as (
    select j.id
      from public.scrape_jobs j
     where j.status in ('starting', 'running', 'cancelling')
       and (j.lease_expires_at is null or j.lease_expires_at < now())
     order by j.lease_expires_at nulls first
     for update skip locked
     limit p_limit
  ), updated as (
    update public.scrape_jobs j
       set status = case
                      when j.attempts >= j.max_attempts then 'failed'::public.scrape_job_status
                      when j.cancel_requested then 'cancelled'::public.scrape_job_status
                      else 'queued'::public.scrape_job_status
                    end,
           worker_id = null,
           claimed_at = null,
           heartbeat_at = null,
           lease_expires_at = null,
           completed_at = case when j.attempts >= j.max_attempts or j.cancel_requested then now() else null end,
           error_message = case
             when j.attempts >= j.max_attempts then 'Job exceeded maximum attempts after worker interruption.'
             when j.cancel_requested then null
             else coalesce(j.error_message, 'Worker interrupted; job requeued.')
           end,
           updated_at = now()
      from orphaned o
     where j.id = o.id
    returning j.id, j.status
  )
  select id from updated;
end;
$$;

create or replace function public.increment_job_counters(p_job_id uuid, p_deltas jsonb)
returns public.scrape_jobs
language plpgsql
as $$
declare
  v_job public.scrape_jobs;
begin
  update public.scrape_jobs j
     set actual_results = j.actual_results + coalesce((p_deltas ->> 'actual_results')::int, 0),
         unique_results = j.unique_results + coalesce((p_deltas ->> 'unique_results')::int, 0),
         duplicates     = j.duplicates     + coalesce((p_deltas ->> 'duplicates')::int, 0),
         filtered       = j.filtered       + coalesce((p_deltas ->> 'filtered')::int, 0),
         websites_found = j.websites_found + coalesce((p_deltas ->> 'websites_found')::int, 0),
         phones_found   = j.phones_found   + coalesce((p_deltas ->> 'phones_found')::int, 0),
         emails_found   = j.emails_found   + coalesce((p_deltas ->> 'emails_found')::int, 0),
         verified_emails = j.verified_emails + coalesce((p_deltas ->> 'verified_emails')::int, 0),
         billable_leads = j.billable_leads + coalesce((p_deltas ->> 'billable_leads')::int, 0),
         errors         = j.errors         + coalesce((p_deltas ->> 'errors')::int, 0),
         error_message  = coalesce((p_deltas ->> 'error_message'), j.error_message),
         last_error_code = coalesce((p_deltas ->> 'last_error_code'), j.last_error_code),
         updated_at = now()
   where j.id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.complete_scrape_job(
  p_job_id uuid,
  p_status public.scrape_job_status,
  p_error text default null,
  p_error_code text default null
)
returns public.scrape_jobs
language plpgsql
as $$
declare
  v_job public.scrape_jobs;
begin
  update public.scrape_jobs j
     set status = p_status,
         completed_at = now(),
         cancelled_at = case when p_status = 'cancelled' then now() else j.cancelled_at end,
         error_message = p_error,
         last_error_code = p_error_code,
         worker_id = null,
         claimed_at = null,
         heartbeat_at = null,
         lease_expires_at = null,
         cancel_requested = false,
         pause_requested = false,
         updated_at = now()
   where j.id = p_job_id
  returning * into v_job;

  insert into public.scrape_job_events (job_id, workspace_id, event, status, message, error_code, counters)
  values (
    v_job.id, v_job.workspace_id,
    'job.' || p_status::text,
    p_status, p_error, p_error_code,
    jsonb_build_object(
      'actual_results', v_job.actual_results,
      'unique_results', v_job.unique_results,
      'duplicates', v_job.duplicates,
      'filtered', v_job.filtered,
      'websites_found', v_job.websites_found,
      'phones_found', v_job.phones_found,
      'emails_found', v_job.emails_found,
      'verified_emails', v_job.verified_emails,
      'billable_leads', v_job.billable_leads,
      'errors', v_job.errors
    )
  );

  -- Keep the parent search in sync.
  if v_job.search_id is not null then
    update public.searches s
       set status = p_status,
           result_count = v_job.unique_results,
           error_message = p_error,
           completed_at = now(),
           duration_ms = extract(epoch from (now() - coalesce(v_job.started_at, now()))) * 1000,
           updated_at = now()
     where s.id = v_job.search_id;
  end if;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lead persistence + deduplication (§8, §9)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_lead(
  p_workspace uuid,
  p_dedupe_key text,
  p_payload jsonb,
  p_emails jsonb default '[]'::jsonb,
  p_phones jsonb default '[]'::jsonb,
  p_job_id uuid default null,
  p_search_id uuid default null,
  p_is_dev boolean default false
)
returns table (lead_id uuid, outcome text, is_new boolean)
language plpgsql
as $$
declare
  v_id uuid;
  v_is_new boolean := false;
  v_email jsonb;
  v_phone jsonb;
begin
  insert into public.leads (
    workspace_id, source, source_id, source_job_id, search_id,
    business_name, category, categories, website, maps_url,
    address, street, city, state, country, postal_code,
    latitude, longitude, rating, review_count, business_status,
    opening_hours, description, social_links, logo_url, price_range,
    plus_code, source_metadata, lead_score, dedupe_key, is_dev_data
  )
  values (
    p_workspace,
    coalesce((p_payload ->> 'source')::public.lead_source, 'google_maps'),
    p_payload ->> 'source_id',
    p_job_id,
    p_search_id,
    p_payload ->> 'business_name',
    p_payload ->> 'category',
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_payload -> 'categories')), '{}'),
    p_payload ->> 'website',
    p_payload ->> 'maps_url',
    p_payload ->> 'address',
    p_payload ->> 'street',
    p_payload ->> 'city',
    p_payload ->> 'state',
    p_payload ->> 'country',
    p_payload ->> 'postal_code',
    nullif(p_payload ->> 'latitude', '')::double precision,
    nullif(p_payload ->> 'longitude', '')::double precision,
    nullif(p_payload ->> 'rating', '')::numeric,
    nullif(p_payload ->> 'review_count', '')::integer,
    p_payload ->> 'business_status',
    p_payload -> 'opening_hours',
    p_payload ->> 'description',
    coalesce(p_payload -> 'social_links', '{}'::jsonb),
    p_payload ->> 'logo_url',
    p_payload ->> 'price_range',
    p_payload ->> 'plus_code',
    coalesce(p_payload -> 'source_metadata', '{}'::jsonb),
    coalesce((p_payload ->> 'lead_score')::int, 0),
    p_dedupe_key,
    p_is_dev
  )
  on conflict (workspace_id, dedupe_key) where deleted_at is null
  do update set
    -- Merge: only fill fields that are currently empty, and bump times_seen.
    website       = coalesce(public.leads.website, excluded.website),
    primary_phone = coalesce(public.leads.primary_phone, excluded.primary_phone),
    primary_email = coalesce(public.leads.primary_email, excluded.primary_email),
    category      = coalesce(public.leads.category, excluded.category),
    categories    = case
                      when array_length(public.leads.categories, 1) > 0 then public.leads.categories
                      else excluded.categories end,
    description   = coalesce(public.leads.description, excluded.description),
    logo_url      = coalesce(public.leads.logo_url, excluded.logo_url),
    rating        = coalesce(excluded.rating, public.leads.rating),
    review_count  = greatest(coalesce(excluded.review_count, 0), coalesce(public.leads.review_count, 0)),
    social_links  = case
                      when public.leads.social_links = '{}'::jsonb then excluded.social_links
                      else public.leads.social_links end,
    source_metadata = public.leads.source_metadata || excluded.source_metadata,
    times_seen    = public.leads.times_seen + 1,
    search_id     = coalesce(public.leads.search_id, excluded.search_id),
    updated_at    = now()
  returning id, (xmax = 0) into v_id, v_is_new;

  -- Contact rows: insert-only conflict handling, first-seen wins for primary.
  for v_email in select value from jsonb_array_elements(p_emails)
  loop
    insert into public.lead_emails (lead_id, workspace_id, email, status, source, confidence)
    values (
      v_id, p_workspace, (v_email ->> 'email')::citext,
      coalesce((v_email ->> 'status')::public.email_verification_status, 'unknown'),
      coalesce(v_email ->> 'source', 'google_maps'),
      nullif(v_email ->> 'confidence', '')::numeric
    )
    on conflict (lead_id, email) do update set
      status = case
        when public.lead_emails.status = 'unknown' then excluded.status
        else public.lead_emails.status end,
      verified_at = coalesce(public.lead_emails.verified_at, excluded.verified_at),
      updated_at = now();
  end loop;

  for v_phone in select value from jsonb_array_elements(p_phones)
  loop
    insert into public.lead_phones (lead_id, workspace_id, e164, raw, kind)
    values (
      v_id, p_workspace,
      v_phone ->> 'e164', v_phone ->> 'raw', v_phone ->> 'kind'
    )
    on conflict (lead_id, e164) do nothing;
  end loop;

  -- Mirror the best available contact onto the lead row for filtering/export.
  update public.leads l
     set primary_email = coalesce(l.primary_email, (
           select e.email::text from public.lead_emails e
            where e.lead_id = v_id order by e.is_primary desc, e.created_at limit 1)),
         primary_phone = coalesce(l.primary_phone, (
           select p.e164 from public.lead_phones p
            where p.lead_id = v_id order by p.is_primary desc, p.created_at limit 1)),
         email_status = coalesce((
           select e.status from public.lead_emails e
            where e.lead_id = v_id order by e.is_primary desc, e.created_at limit 1), 'unknown'),
         updated_at = now()
   where l.id = v_id;

  return query select v_id, case when v_is_new then 'inserted' else 'merged' end, v_is_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker registry helpers
-- ---------------------------------------------------------------------------

create or replace function public.worker_heartbeat(
  p_worker_id text,
  p_hostname text default null,
  p_region text default null,
  p_version text default null,
  p_status text default 'online',
  p_max_concurrency integer default 1,
  p_stats jsonb default '{}'::jsonb
)
returns public.workers
language plpgsql
as $$
declare
  v_worker public.workers;
begin
  insert into public.workers as w (worker_id, hostname, region, version, status, max_concurrency, last_heartbeat_at, started_at, stats)
  values (p_worker_id, p_hostname, p_region, p_version, p_status, p_max_concurrency, now(), now(), p_stats)
  on conflict (worker_id) do update set
    last_heartbeat_at = now(),
    status = excluded.status,
    region = coalesce(excluded.region, w.region),
    version = coalesce(excluded.version, w.version),
    max_concurrency = excluded.max_concurrency,
    stats = excluded.stats,
    stopped_at = case when excluded.status = 'offline' then now() else null end
  returning * into v_worker;

  return v_worker;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (§33)
-- ---------------------------------------------------------------------------

create or replace function public.rate_limit_check(
  p_scope text,
  p_identifier text,
  p_limit integer,
  p_window_ms integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz, retry_after_ms integer)
language plpgsql
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms / 1000);
  v_count integer;
begin
  insert into public.rate_limit_buckets (scope, identifier, window_start, count)
  values (p_scope, p_identifier, v_window, 1)
  on conflict (scope, identifier, window_start) do update set
    count = public.rate_limit_buckets.count + 1,
    updated_at = now()
  returning count into v_count;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window + (p_window_ms || ' milliseconds')::interval,
    case when v_count > p_limit
         then (extract(epoch from (v_window + (p_window_ms || ' milliseconds')::interval - now())) * 1000)::int
         else 0 end;
end;
$$;
