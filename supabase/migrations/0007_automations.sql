-- Zybble — 0007: automations and automation runs
--
-- Trigger → Conditions → Actions. Execution is always server/worker controlled,
-- and every action carries an idempotency key so it can only happen once (§24).

create table if not exists public.automations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  name          text not null,
  description   text,
  status        public.automation_status not null default 'draft',
  -- { type: 'search_completed' | 'lead_added_to_list' | 'lead_created' | 'campaign_completed', ... }
  trigger       jsonb not null,
  -- [{ field, operator, value }]
  conditions    jsonb not null default '[]'::jsonb,
  -- [{ type: 'add_to_list' | 'add_to_campaign' | 'add_tag' | 'send_notification', params }]
  actions       jsonb not null default '[]'::jsonb,
  runs_count    integer not null default 0,
  last_run_at   timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists automations_workspace_idx on public.automations (workspace_id, created_at desc);
create index if not exists automations_active_idx
  on public.automations ((trigger ->> 'type'))
  where status = 'active' and deleted_at is null;

create table if not exists public.automation_runs (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  status        public.automation_run_status not null default 'running',
  trigger_event text not null,
  -- Idempotency: trigger event + subject guarantees at-most-once execution.
  idempotency_key text not null,
  subject       jsonb not null default '{}'::jsonb,
  conditions_met boolean,
  actions_run   jsonb not null default '[]'::jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  constraint automation_runs_idem_unique unique (automation_id, idempotency_key)
);

create index if not exists automation_runs_automation_idx on public.automation_runs (automation_id, started_at desc);
create index if not exists automation_runs_workspace_idx on public.automation_runs (workspace_id, started_at desc);

drop trigger if exists automations_updated_at on public.automations;
create trigger automations_updated_at before update on public.automations
  for each row execute function public.tg_set_updated_at();
