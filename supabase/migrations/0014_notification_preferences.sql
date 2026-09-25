-- Zybble — 0014: per-user notification preferences
--
-- Stored as a jsonb blob on the profile so adding a new event type doesn't
-- require a migration; `default_notification_preferences()` seeds the row on
-- insert. Server-side email sending reads this before every send (§21, §25).

create table if not exists public.notification_preferences (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  preferences   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_self on public.notification_preferences;
create policy notification_preferences_self on public.notification_preferences
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Defaults used when a user has never saved preferences.
create or replace function public.default_notification_preferences()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{
    "searchCompleted": true,
    "searchFailed": true,
    "subscriptionChanged": true,
    "paymentFailed": true,
    "campaignCompleted": true,
    "usageThreshold": true,
    "securityAlerts": true,
    "productUpdates": false
  }'::jsonb;
$$;

create or replace function public.notification_preferences_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function public.notification_preferences_set_updated_at();

-- New profiles start with the sensible defaults.
create or replace function public.seed_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id, preferences)
  values (new.id, public.default_notification_preferences())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_seed_notification_preferences on public.profiles;
create trigger profiles_seed_notification_preferences
  after insert on public.profiles
  for each row execute function public.seed_notification_preferences();
