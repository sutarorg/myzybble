-- Zybble — 0004: scrape jobs, job events, worker registry
--
-- The queue is a plain Postgres table claimed with `FOR UPDATE SKIP LOCKED`.
-- This gives atomic claiming, crash recovery (heartbeat/lease expiry) and
-- pause/resume/cancel without introducing Redis (§3, §5, §6).

create table if not exists public.workers (
  id             uuid primary key default gen_random_uuid(),
  worker_id      text not null unique,
  hostname       text,
  region         text,
  version        text,
  status         text not null default 'online' check (status in ('online', 'draining', 'offline')),
  max_concurrency integer not null default 1,
  last_heartbeat_at timestamptz not null default now(),
  started_at     timestamptz not null default now(),
  stopped_at     timestamptz,
  stats          jsonb not null default '{}'::jsonb
);

create index if not exists workers_status_idx on public.workers (status, last_heartbeat_at desc);

create table if not exists public.scrape_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  search_id        uuid,                                  -- set in 0005
  status           public.scrape_job_status not null default 'queued',

  -- Requested search parameters (§7)
  keywords         text[] not null default '{}',
  locations        text[] not null default '{}',
  radius           integer,                                -- metres
  requested_limit  integer not null default 100 check (requested_limit > 0 and requested_limit <= 200000),
  language         text default 'en',
  min_rating       numeric(3, 2),
  min_review_count integer,
  require_website  boolean not null default false,
  require_phone    boolean not null default false,
  require_email    boolean not null default false,
  business_status  text default 'all',
  extra_options    jsonb not null default '{}'::jsonb,

  -- Real, database-backed counters (§6). Never fabricated.
  actual_results    integer not null default 0,
  unique_results    integer not null default 0,
  duplicates        integer not null default 0,
  filtered          integer not null default 0,
  websites_found    integer not null default 0,
  phones_found      integer not null default 0,
  emails_found      integer not null default 0,
  verified_emails   integer not null default 0,
  billable_leads    integer not null default 0,
  errors            integer not null default 0,
  error_message     text,
  last_error_code   text,

  -- Lifecycle
  attempts         integer not null default 0,
  max_attempts     integer not null default 3,
  progress         jsonb not null default '{}'::jsonb,
  started_at       timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Claiming / lease
  worker_id        text,
  claimed_at       timestamptz,
  heartbeat_at     timestamptz,
  lease_expires_at timestamptz,
  cancel_requested boolean not null default false,
  pause_requested  boolean not null default false,

  engine           text not null default 'gosom/google-maps-scraper',
  engine_version   text,

  constraint scrape_jobs_terminal_status check (
    status not in ('completed', 'failed', 'cancelled') or completed_at is not null
  )
);

-- The claim query: queued jobs, oldest first.
create index if not exists scrape_jobs_queue_idx
  on public.scrape_jobs (created_at)
  where status = 'queued';

create index if not exists scrape_jobs_workspace_idx on public.scrape_jobs (workspace_id, created_at desc);
create index if not exists scrape_jobs_status_idx on public.scrape_jobs (status);
-- Orphan recovery: running jobs whose lease has expired.
create index if not exists scrape_jobs_lease_idx
  on public.scrape_jobs (lease_expires_at)
  where status in ('starting', 'running', 'cancelling');

-- At most one non-terminal job per workspace prevents quota bypass by fan-out
-- of simultaneous jobs (§10).
create unique index if not exists scrape_jobs_one_active_per_workspace
  on public.scrape_jobs (workspace_id)
  where status in ('queued', 'starting', 'running', 'paused', 'cancelling');

create table if not exists public.scrape_job_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.scrape_jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event       text not null,
  status      public.scrape_job_status,
  message     text,
  counters    jsonb,
  worker_id   text,
  error_code  text,
  created_at  timestamptz not null default now()
);

create index if not exists scrape_job_events_job_idx on public.scrape_job_events (job_id, created_at);

drop trigger if exists scrape_jobs_updated_at on public.scrape_jobs;
create trigger scrape_jobs_updated_at before update on public.scrape_jobs
  for each row execute function public.tg_set_updated_at();

drop trigger if exists workers_updated_at on public.workers;
