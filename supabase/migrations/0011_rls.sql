-- Zybble — 0011: Row Level Security
--
-- Defence in depth (§14): authentication + server-side authorisation + RLS.
-- RLS is the last line; the UI is never trusted to hide data.
--
-- Note: `service_role` bypasses RLS entirely, so every path that uses the
-- admin client performs its own explicit authorisation check first.

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can't recurse)
-- ---------------------------------------------------------------------------

create or replace function public.workspace_ids_for_user()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select wm.workspace_id from public.workspace_members wm where wm.user_id = auth.uid()
$$;

create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace and wm.user_id = auth.uid()
  )
$$;

create or replace function public.is_workspace_admin(p_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace
       and wm.user_id = auth.uid()
       and wm.role in ('owner', 'admin')
  )
$$;

create or replace function public.is_workspace_owner(p_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
     where w.id = p_workspace and w.owner_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every user-owned table
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','workspaces','workspace_members','plans','subscriptions','usage',
    'usage_events','entitlements','billing_events','scrape_jobs','scrape_job_events',
    'leads','lead_emails','lead_phones','lead_tags','lists','list_members','searches',
    'campaigns','campaign_steps','campaign_leads','mailboxes','suppression_entries',
    'email_events','automations','automation_runs','ai_conversations','ai_messages',
    'notifications','audit_logs','exports','workers','rate_limit_buckets'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Force RLS even for the table owner, which is how Supabase expects policies
    -- to behave for the anon/authenticated roles.
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ===========================================================================
-- profiles
-- ===========================================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete using (id = auth.uid());

-- ===========================================================================
-- workspaces
-- ===========================================================================
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin on public.workspaces
  for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

-- Only the owner may delete a workspace (§34).
drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner on public.workspaces
  for delete using (owner_id = auth.uid());

-- ===========================================================================
-- workspace_members
-- ===========================================================================
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_manage on public.workspace_members;
create policy workspace_members_manage on public.workspace_members
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- ===========================================================================
-- plans — readable by everyone (pricing page), writable only by service role
-- ===========================================================================
drop policy if exists plans_select_public on public.plans;
create policy plans_select_public on public.plans for select using (true);

-- ===========================================================================
-- billing: read-only for members. Mutations happen server-side only.
-- ===========================================================================
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists usage_select on public.usage;
create policy usage_select on public.usage
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists usage_events_select on public.usage_events;
create policy usage_events_select on public.usage_events
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists entitlements_select on public.entitlements;
create policy entitlements_select on public.entitlements
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists billing_events_select on public.billing_events;
create policy billing_events_select on public.billing_events
  for select using (workspace_id is not null and public.is_workspace_member(workspace_id));

-- ===========================================================================
-- scraping
-- ===========================================================================
drop policy if exists scrape_jobs_select on public.scrape_jobs;
create policy scrape_jobs_select on public.scrape_jobs
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists scrape_jobs_insert on public.scrape_jobs;
create policy scrape_jobs_insert on public.scrape_jobs
  for insert with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- Users may only request pause / resume / cancel. All other transitions are
-- performed server-side with the service-role client.
drop policy if exists scrape_jobs_update_user on public.scrape_jobs;
create policy scrape_jobs_update_user on public.scrape_jobs
  for update using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and status in ('queued', 'paused', 'cancelling')
    and (pause_requested is true or cancel_requested is true or status = 'queued')
  );

drop policy if exists scrape_job_events_select on public.scrape_job_events;
create policy scrape_job_events_select on public.scrape_job_events
  for select using (public.is_workspace_member(workspace_id));

-- ===========================================================================
-- leads and contacts
-- ===========================================================================
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete using (public.is_workspace_member(workspace_id));

drop policy if exists lead_emails_all on public.lead_emails;
create policy lead_emails_all on public.lead_emails
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists lead_phones_all on public.lead_phones;
create policy lead_phones_all on public.lead_phones
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists lead_tags_select on public.lead_tags;
create policy lead_tags_select on public.lead_tags
  for select using (
    exists (select 1 from public.leads l where l.id = lead_id and public.is_workspace_member(l.workspace_id))
  );

drop policy if exists lead_tags_manage on public.lead_tags;
create policy lead_tags_manage on public.lead_tags
  for all using (
    exists (select 1 from public.leads l where l.id = lead_id and public.is_workspace_member(l.workspace_id))
  ) with check (
    exists (select 1 from public.leads l where l.id = lead_id and public.is_workspace_member(l.workspace_id))
  );

-- ===========================================================================
-- lists / searches
-- ===========================================================================
drop policy if exists lists_all on public.lists;
create policy lists_all on public.lists
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists list_members_select on public.list_members;
create policy list_members_select on public.list_members
  for select using (
    exists (select 1 from public.lists l where l.id = list_id and public.is_workspace_member(l.workspace_id))
  );

drop policy if exists list_members_manage on public.list_members;
create policy list_members_manage on public.list_members
  for all using (
    exists (select 1 from public.lists l where l.id = list_id and public.is_workspace_member(l.workspace_id))
  ) with check (
    exists (select 1 from public.lists l where l.id = list_id and public.is_workspace_member(l.workspace_id))
  );

drop policy if exists searches_all on public.searches;
create policy searches_all on public.searches
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ===========================================================================
-- outreach
-- ===========================================================================
drop policy if exists mailboxes_all on public.mailboxes;
create policy mailboxes_all on public.mailboxes
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists campaigns_all on public.campaigns;
create policy campaigns_all on public.campaigns
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists campaign_steps_all on public.campaign_steps;
create policy campaign_steps_all on public.campaign_steps
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists campaign_leads_all on public.campaign_leads;
create policy campaign_leads_all on public.campaign_leads
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists suppression_entries_select on public.suppression_entries;
create policy suppression_entries_select on public.suppression_entries
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists suppression_entries_manage on public.suppression_entries;
create policy suppression_entries_manage on public.suppression_entries
  for insert with check (public.is_workspace_member(workspace_id));

-- Unsubscribe must work without a session: the public route uses service role.
drop policy if exists email_events_select on public.email_events;
create policy email_events_select on public.email_events
  for select using (workspace_id is not null and public.is_workspace_member(workspace_id));

-- ===========================================================================
-- automations
-- ===========================================================================
drop policy if exists automations_all on public.automations;
create policy automations_all on public.automations
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists automation_runs_select on public.automation_runs;
create policy automation_runs_select on public.automation_runs
  for select using (public.is_workspace_member(workspace_id));

-- ===========================================================================
-- AI
-- ===========================================================================
drop policy if exists ai_conversations_own on public.ai_conversations;
create policy ai_conversations_own on public.ai_conversations
  for all using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists ai_messages_own on public.ai_messages;
create policy ai_messages_own on public.ai_messages
  for all using (
    exists (
      select 1 from public.ai_conversations c
       where c.id = conversation_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.ai_conversations c
       where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- ===========================================================================
-- platform
-- ===========================================================================
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (public.is_workspace_member(workspace_id) and (user_id is null or user_id = auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (
    (workspace_id is not null and public.is_workspace_admin(workspace_id)) or actor_user_id = auth.uid()
  );

drop policy if exists exports_select on public.exports;
create policy exports_select on public.exports
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists exports_insert on public.exports;
create policy exports_insert on public.exports
  for insert with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- Workers are an operational table: readable by admins only (§35).
drop policy if exists workers_select_admin on public.workers;
create policy workers_select_admin on public.workers
  for select using (
    exists (
      select 1 from public.workspace_members wm
       where wm.user_id = auth.uid() and wm.role = 'owner'
    )
  );

-- rate_limit_buckets is internal: no client access at all.
