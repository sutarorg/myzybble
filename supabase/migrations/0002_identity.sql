-- Zybble — 0002: identity (profiles, workspaces, workspace_members)

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       citext not null,
  full_name   text,
  avatar_url  text,
  company     text,
  timezone    text default 'UTC',
  -- privacy / retention preferences (§34)
  marketing_opt_in     boolean not null default false,
  product_email_opt_in boolean not null default true,
  data_retention_days  integer not null default 730 check (data_retention_days between 30 and 3650),
  deletion_requested_at timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_email_not_blank check (length(email) > 3)
);

create index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  owner_id    uuid not null references public.profiles (id) on delete restrict,
  -- Denormalised pointer to the current plan for fast entitlement reads.
  plan_id     uuid,
  billing_email citext,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.workspace_role not null default 'member',
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- Bootstrap a profile + personal workspace when a user signs up.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text;
  v_slug   text;
  v_ws_id  uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  v_handle := lower(regexp_replace(
    split_part(coalesce(new.email, 'user'), '@', 1),
    '[^a-zA-Z0-9]', '', 'g'
  ));
  v_handle := case when length(v_handle) < 3 then 'ws' else left(v_handle, 24) end;
  v_slug := v_handle || '-' || substr(md5(new.id::text), 1, 6);

  insert into public.workspaces (name, slug, owner_id, billing_email)
  values (
    coalesce(new.raw_user_meta_data ->> 'full_name', 'My workspace'),
    v_slug,
    new.id,
    new.email
  )
  returning id into v_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.tg_set_updated_at();

drop trigger if exists workspace_members_updated_at on public.workspace_members;
create trigger workspace_members_updated_at before update on public.workspace_members
  for each row execute function public.tg_set_updated_at();
