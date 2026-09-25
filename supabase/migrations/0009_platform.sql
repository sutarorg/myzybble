-- Zybble — 0009: notifications, audit logs, exports, rate limiting

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete cascade,
  type          public.notification_type not null default 'system',
  title         text not null,
  body          text,
  href          text,
  severity      text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  -- Idempotency so repeated events don't spam the user (§26).
  dedupe_key    text,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint notifications_dedupe_unique unique (workspace_id, dedupe_key)
);

create index if not exists notifications_user_idx
  on public.notifications (workspace_id, user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (workspace_id, user_id)
  where read_at is null;

create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_type    text not null default 'user' check (actor_type in ('user', 'system', 'worker', 'admin')),
  action        public.audit_action not null,
  entity_type   text not null,
  entity_id     text,
  -- Request correlation (§32).
  request_id    text,
  ip            inet,
  user_agent    text,
  changes       jsonb,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Exports: large CSV jobs run out-of-band so they never sit inside a request
-- lifecycle (§38).
-- ---------------------------------------------------------------------------

create table if not exists public.exports (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete set null,
  kind           text not null default 'leads' check (kind in ('leads', 'list', 'search', 'campaign')),
  status         public.export_status not null default 'queued',
  filters        jsonb not null default '{}'::jsonb,
  columns        text[] not null default '{}',
  lead_ids       uuid[],
  row_count      integer not null default 0,
  file_path      text,
  file_size_bytes bigint,
  -- One-time download token, never a public URL.
  download_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  error          text,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists exports_workspace_idx on public.exports (workspace_id, created_at desc);
create index if not exists exports_queue_idx on public.exports (created_at) where status = 'queued';

-- ---------------------------------------------------------------------------
-- Rate limiting: fixed-window counters keyed by scope+identifier. Server-side
-- only, and atomically upserted (§33).
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limit_buckets (
  scope       text not null,
  identifier text not null,
  window_start timestamptz not null,
  count       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (scope, identifier, window_start)
);

create index if not exists rate_limit_window_idx on public.rate_limit_buckets (window_start);

drop trigger if exists exports_updated_at on public.exports;
create trigger exports_updated_at before update on public.exports
  for each row execute function public.tg_set_updated_at();
