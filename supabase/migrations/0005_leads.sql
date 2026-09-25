-- Zybble — 0005: leads, contacts, tags, lists, searches
--
-- Designed for millions of rows per workspace: targeted composite indexes,
-- server-side filtering, keyset pagination, no SELECT * in hot paths.

create table if not exists public.searches (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete set null,
  name           text,
  keywords       text[] not null default '{}',
  locations      text[] not null default '{}',
  radius         integer,
  requested_limit integer not null default 100,
  language       text default 'en',
  min_rating     numeric(3, 2),
  min_review_count integer,
  require_website boolean not null default false,
  require_phone   boolean not null default false,
  require_email   boolean not null default false,
  business_status text default 'all',
  extra_options  jsonb not null default '{}'::jsonb,
  status         public.scrape_job_status not null default 'queued',
  result_count   integer not null default 0,
  error_message  text,
  duration_ms    integer,
  last_job_id    uuid,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists searches_workspace_idx on public.searches (workspace_id, created_at desc);
create index if not exists searches_status_idx on public.searches (workspace_id, status);

-- ---------------------------------------------------------------------------

create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  source         public.lead_source not null default 'google_maps',
  source_id      text,                                    -- Google place id / cid
  source_job_id  uuid references public.scrape_jobs (id) on delete set null,
  search_id      uuid references public.searches (id) on delete set null,

  business_name  text not null,
  category       text,
  categories     text[] not null default '{}',
  website        text,
  maps_url       text,
  address        text,
  street         text,
  city           text,
  state          text,
  country        text,
  postal_code    text,
  latitude       double precision,
  longitude      double precision,

  -- Contact data is stored relationally (multiple phones / emails) and mirrored
  -- onto the lead row for cheap filtering and CSV export.
  primary_phone  text,
  primary_email  text,
  email_status   public.email_verification_status not null default 'unknown',

  rating         numeric(3, 2),
  review_count   integer,
  business_status text,
  opening_hours  jsonb,
  description    text,
  social_links   jsonb not null default '{}'::jsonb,
  logo_url       text,
  price_range    text,
  plus_code      text,
  source_metadata jsonb not null default '{}'::jsonb,

  lead_score     integer not null default 0,
  notes          text,
  contacted_at   timestamptz,
  times_seen     integer not null default 1,
  -- Identity for deduplication (§9). Strongest available signal wins.
  dedupe_key     text not null,
  is_dev_data    boolean not null default false,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Dedupe: one lead per identity per workspace.
create unique index if not exists leads_dedupe_unique
  on public.leads (workspace_id, dedupe_key)
  where deleted_at is null;

-- Primary list/browse path: workspace + recency, keyset pagination.
create index if not exists leads_workspace_created_idx
  on public.leads (workspace_id, created_at desc, id desc)
  where deleted_at is null;

create index if not exists leads_workspace_name_idx
  on public.leads (workspace_id, lower(business_name))
  where deleted_at is null;

-- Trigram index powers ilike search without a full scan.
create index if not exists leads_name_trgm_idx
  on public.leads using gin (lower(business_name) gin_trgm_ops);

create index if not exists leads_city_idx on public.leads (workspace_id, lower(city)) where deleted_at is null;
create index if not exists leads_category_idx on public.leads (workspace_id, lower(category)) where deleted_at is null;
create index if not exists leads_email_status_idx on public.leads (workspace_id, email_status) where deleted_at is null;
create index if not exists leads_score_idx on public.leads (workspace_id, lead_score desc, id desc) where deleted_at is null;
create index if not exists leads_rating_idx on public.leads (workspace_id, rating desc) where deleted_at is null;
create index if not exists leads_has_email_idx on public.leads (workspace_id, id) where primary_email is not null and deleted_at is null;
create index if not exists leads_has_phone_idx on public.leads (workspace_id, id) where primary_phone is not null and deleted_at is null;
create index if not exists leads_source_job_idx on public.leads (source_job_id) where source_job_id is not null;
create index if not exists leads_search_idx on public.leads (search_id) where search_id is not null;
create index if not exists leads_country_state_idx on public.leads (workspace_id, country, state) where deleted_at is null;
create index if not exists leads_tags_idx on public.leads using gin (categories);

-- Full-text search vector (business name + category + city + address).
alter table public.leads
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(business_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(address, '')), 'C')
  ) stored;

create index if not exists leads_search_vector_idx on public.leads using gin (search_vector);

-- ---------------------------------------------------------------------------

create table if not exists public.lead_emails (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         citext not null,
  status        public.email_verification_status not null default 'unknown',
  is_primary    boolean not null default false,
  source        text not null default 'google_maps',
  -- Verification evidence: never assume an email is valid because it exists (§8).
  verified_at   timestamptz,
  verification_provider text,
  verification_result jsonb,
  confidence    numeric(4, 3),
  reason        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lead_emails_lead_email_unique unique (lead_id, email)
);

create index if not exists lead_emails_lead_idx on public.lead_emails (lead_id);
create index if not exists lead_emails_workspace_email_idx on public.lead_emails (workspace_id, email);
create index if not exists lead_emails_status_idx on public.lead_emails (workspace_id, status);

create table if not exists public.lead_phones (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  e164          text not null,                 -- canonical form used for dedupe
  raw           text not null,
  kind          text,                          -- mobile | landline | unknown
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lead_phones_lead_phone_unique unique (lead_id, e164)
);

create index if not exists lead_phones_lead_idx on public.lead_phones (lead_id);
create index if not exists lead_phones_workspace_idx on public.lead_phones (workspace_id, e164);

create table if not exists public.lead_tags (
  lead_id  uuid not null references public.leads (id) on delete cascade,
  tag      text not null,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag)
);

create index if not exists lead_tags_tag_idx on public.lead_tags (tag);

-- ---------------------------------------------------------------------------

create table if not exists public.lists (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by   uuid references public.profiles (id) on delete set null,
  name         text not null,
  description  text,
  color        text default 'lime',
  archived_at  timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lists_name_unique_per_workspace unique (workspace_id, name)
);

create index if not exists lists_workspace_idx on public.lists (workspace_id, created_at desc);

create table if not exists public.list_members (
  list_id  uuid not null references public.lists (id) on delete cascade,
  lead_id  uuid not null references public.leads (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Prevents duplicate membership (§17).
  primary key (list_id, lead_id)
);

create index if not exists list_members_lead_idx on public.list_members (lead_id);

-- ---------------------------------------------------------------------------

alter table public.scrape_jobs
  add constraint scrape_jobs_search_fk
  foreign key (search_id) references public.searches (id) on delete set null;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.tg_set_updated_at();

drop trigger if exists lead_emails_updated_at on public.lead_emails;
create trigger lead_emails_updated_at before update on public.lead_emails
  for each row execute function public.tg_set_updated_at();

drop trigger if exists lead_phones_updated_at on public.lead_phones;
create trigger lead_phones_updated_at before update on public.lead_phones
  for each row execute function public.tg_set_updated_at();

drop trigger if exists lists_updated_at on public.lists;
create trigger lists_updated_at before update on public.lists
  for each row execute function public.tg_set_updated_at();

drop trigger if exists searches_updated_at on public.searches;
create trigger searches_updated_at before update on public.searches
  for each row execute function public.tg_set_updated_at();
