-- Zybble — 0003: plans, subscriptions, usage, entitlements, billing events
--
-- Pricing is server-authoritative and stored in the database. The client never
-- decides plan, price, quota or entitlement.

create table if not exists public.plans (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,             -- starter, growth, pro, ...
  name           text not null,
  price_cents    integer not null check (price_cents >= 0),
  currency       char(3) not null default 'USD',
  interval       public.billing_interval not null default 'monthly',
  monthly_leads  integer not null check (monthly_leads > 0),
  -- Feature flags are identical across every Zybble plan (§10) but stored so the
  -- server — not the client — owns the answer.
  features       jsonb not null default '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  -- Provider identifiers, filled in by the provisioning script / admin.
  razorpay_plan_id      text unique,
  razorpay_item_id      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists plans_active_idx on public.plans (is_active, sort_order);

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  plan_id                uuid references public.plans (id) on delete set null,
  status                 public.subscription_status not null default 'incomplete',
  currency               char(3) not null default 'USD',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  cancelled_at           timestamptz,
  trial_ends_at          timestamptz,
  -- Razorpay identifiers (§11)
  razorpay_customer_id     text,
  razorpay_plan_id         text,
  razorpay_subscription_id text unique,
  razorpay_payment_id      text,
  razorpay_order_id        text,
  last_payment_at          timestamptz,
  last_payment_status      text,
  failed_payment_count     integer not null default 0,
  metadata                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_workspace_idx on public.subscriptions (workspace_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create unique index if not exists subscriptions_one_active_per_ws
  on public.subscriptions (workspace_id)
  where status in ('trialing', 'active', 'past_due');

-- ---------------------------------------------------------------------------
-- Usage: one row per workspace per calendar month (UTC).
-- `leads_used` counts *billable leads*: unique leads successfully persisted.
-- ---------------------------------------------------------------------------

create table if not exists public.usage (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  leads_used    bigint not null default 0,
  leads_limit   integer not null default 0,
  searches_run  integer not null default 0,
  exports_run   integer not null default 0,
  ai_requests   integer not null default 0,
  emails_sent   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint usage_period_unique unique (workspace_id, period_start),
  constraint usage_period_valid check (period_end > period_start),
  constraint usage_count_non_negative check (
    leads_used >= 0 and searches_run >= 0 and exports_run >= 0
    and ai_requests >= 0 and emails_sent >= 0
  )
);

create index if not exists usage_workspace_period_idx on public.usage (workspace_id, period_start desc);

-- Append-only ledger of every billable / metered event. Replaying this table
-- must reproduce `usage`, which is what makes the counter recoverable.
create table if not exists public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  metric        text not null check (metric in ('leads', 'searches', 'exports', 'ai_requests', 'emails_sent')),
  delta         integer not null,
  -- Idempotency: the same logical event can never be counted twice.
  idempotency_key text not null,
  period_start  date not null,
  lead_id       uuid,
  scrape_job_id uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint usage_events_idem_unique unique (workspace_id, idempotency_key)
);

create index if not exists usage_events_workspace_period_idx
  on public.usage_events (workspace_id, period_start);
create index if not exists usage_events_created_idx on public.usage_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Entitlements: the authoritative, server-computed answer to "may this
-- workspace do X right now?". Recomputed on every billing/subscription change.
-- ---------------------------------------------------------------------------

create table if not exists public.entitlements (
  workspace_id       uuid primary key references public.workspaces (id) on delete cascade,
  plan_code          text not null default 'free',
  plan_name          text not null default 'Free',
  monthly_leads      integer not null default 100,
  leads_used         bigint not null default 0,
  leads_remaining    bigint not null default 100,
  status             public.subscription_status not null default 'active',
  has_email_data     boolean not null default true,
  has_phone_data     boolean not null default true,
  has_csv_export     boolean not null default true,
  has_ai_assistant   boolean not null default true,
  has_campaigns      boolean not null default true,
  max_seats          integer not null default 1,
  period_start       date,
  period_end         date,
  cancel_at_period_end boolean not null default false,
  computed_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit trail for every provider interaction and state transition.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider      text not null default 'razorpay',
  event_type    text not null,
  -- Provider event id is unique so replayed webhooks are ignored (§11).
  provider_event_id text,
  payload       jsonb not null default '{}'::jsonb,
  signature_valid boolean not null default false,
  status        text not null default 'received',
  error         text,
  attempts      integer not null default 0,
  processed_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint billing_events_provider_id_unique unique (provider, provider_event_id)
);

create index if not exists billing_events_workspace_idx on public.billing_events (workspace_id, created_at desc);
create index if not exists billing_events_type_idx on public.billing_events (event_type, created_at desc);

drop trigger if exists plans_updated_at on public.plans;
create trigger plans_updated_at before update on public.plans
  for each row execute function public.tg_set_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.tg_set_updated_at();

drop trigger if exists usage_updated_at on public.usage;
create trigger usage_updated_at before update on public.usage
  for each row execute function public.tg_set_updated_at();

drop trigger if exists entitlements_updated_at on public.entitlements;
create trigger entitlements_updated_at before update on public.entitlements
  for each row execute function public.tg_set_updated_at();
