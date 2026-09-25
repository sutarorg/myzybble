-- Zybble — 0006: campaigns, steps, recipients, mailboxes, suppression, email events

create table if not exists public.mailboxes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  name          text not null,
  email         citext not null,
  provider      text not null default 'resend',
  status        public.mailbox_status not null default 'pending',
  -- SMTP credentials, when supported, are stored encrypted at rest (§23).
  smtp_host     text,
  smtp_port     integer,
  smtp_username text,
  smtp_password_encrypted text,
  daily_send_limit integer not null default 200,
  sent_today    integer not null default 0,
  verified_at   timestamptz,
  last_error    text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint mailboxes_email_unique unique (workspace_id, email)
);

create index if not exists mailboxes_workspace_idx on public.mailboxes (workspace_id, created_at desc);

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  name          text not null,
  description   text,
  mailbox_id    uuid references public.mailboxes (id) on delete set null,
  status        public.campaign_status not null default 'draft',
  -- Sending is always server-side and rate limited (§22).
  scheduled_at  timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  paused_at     timestamptz,
  timezone      text default 'UTC',
  send_window   jsonb not null default '{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}'::jsonb,
  daily_limit   integer not null default 200,
  stop_on_reply boolean not null default true,
  skip_suppressed boolean not null default true,
  stats         jsonb not null default '{"recipients":0,"sent":0,"delivered":0,"opened":0,"replied":0,"bounced":0,"failed":0,"skipped":0}'::jsonb,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists campaigns_workspace_idx on public.campaigns (workspace_id, created_at desc);
create index if not exists campaigns_status_idx on public.campaigns (status) where status in ('scheduled', 'running');

create table if not exists public.campaign_steps (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  position      integer not null,
  kind          text not null default 'email' check (kind in ('email', 'wait', 'condition')),
  subject       text,
  body          text,
  -- Delay before this step runs.
  delay_minutes integer not null default 0,
  conditions    jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint campaign_steps_position_unique unique (campaign_id, position)
);

create index if not exists campaign_steps_campaign_idx on public.campaign_steps (campaign_id, position);

create table if not exists public.campaign_leads (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  lead_id       uuid not null references public.leads (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         citext not null,
  status        public.campaign_lead_status not null default 'pending',
  current_step  integer not null default 1,
  next_run_at   timestamptz,
  sent_at       timestamptz,
  delivered_at  timestamptz,
  opened_at     timestamptz,
  replied_at    timestamptz,
  bounced_at    timestamptz,
  failed_at     timestamptz,
  attempts      integer not null default 0,
  last_error    text,
  -- Idempotency per (campaign, lead, step): retries never double-send (§22).
  idempotency_key text not null,
  unsubscribe_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint campaign_leads_unique unique (campaign_id, lead_id),
  constraint campaign_leads_idem_unique unique (idempotency_key)
);

create index if not exists campaign_leads_campaign_idx on public.campaign_leads (campaign_id, status);
create index if not exists campaign_leads_due_idx
  on public.campaign_leads (next_run_at)
  where status in ('pending', 'scheduled');
create index if not exists campaign_leads_lead_idx on public.campaign_leads (lead_id);
create index if not exists campaign_leads_token_idx on public.campaign_leads (unsubscribe_token);

-- Suppression list: honoured before every send (§22).
create table if not exists public.suppression_entries (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        citext not null,
  reason       text not null default 'unsubscribed',
  source       text not null default 'user',
  created_at   timestamptz not null default now(),
  constraint suppression_email_unique unique (workspace_id, email)
);

create index if not exists suppression_workspace_idx on public.suppression_entries (workspace_id, email);

-- Raw provider events (Resend webhooks) — idempotent, replay-safe.
create table if not exists public.email_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  provider     text not null default 'resend',
  provider_event_id text,
  event_type   text not null,
  email        citext,
  campaign_id  uuid references public.campaigns (id) on delete set null,
  campaign_lead_id uuid references public.campaign_leads (id) on delete set null,
  payload      jsonb not null default '{}'::jsonb,
  signature_valid boolean not null default false,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  constraint email_events_provider_id_unique unique (provider, provider_event_id)
);

create index if not exists email_events_workspace_idx on public.email_events (workspace_id, created_at desc);
create index if not exists email_events_campaign_idx on public.email_events (campaign_id, event_type);

drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.tg_set_updated_at();

drop trigger if exists campaign_steps_updated_at on public.campaign_steps;
create trigger campaign_steps_updated_at before update on public.campaign_steps
  for each row execute function public.tg_set_updated_at();

drop trigger if exists campaign_leads_updated_at on public.campaign_leads;
create trigger campaign_leads_updated_at before update on public.campaign_leads
  for each row execute function public.tg_set_updated_at();

drop trigger if exists mailboxes_updated_at on public.mailboxes;
create trigger mailboxes_updated_at before update on public.mailboxes
  for each row execute function public.tg_set_updated_at();
