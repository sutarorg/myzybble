-- Zybble — 0015: one-time account-deletion tokens
--
-- Deletion is deliberately two-step. Step 1 issues a single-use token (after
-- re-entering the password) and emails it; step 2 consumes it. A stolen session
-- alone is therefore not enough to delete an account (§26).

create table if not exists public.account_deletion_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists account_deletion_tokens_user_idx
  on public.account_deletion_tokens (user_id, created_at desc);

alter table public.account_deletion_tokens enable row level security;

-- No user-facing policy: the table is only reachable through the SECURITY
-- DEFINER functions below, so a client can neither read nor forge tokens.

create or replace function public.create_account_deletion_token(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text;
begin
  -- Invalidate any outstanding tokens for this user first.
  update public.account_deletion_tokens
     set consumed_at = now()
   where user_id = p_user_id
     and consumed_at is null;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into public.account_deletion_tokens (user_id, token_hash)
  values (p_user_id, encode(digest(raw_token, 'sha256'), 'hex'));

  return raw_token;
end;
$$;

create or replace function public.consume_account_deletion_token(p_user_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.account_deletion_tokens
     set consumed_at = now()
   where user_id = p_user_id
     and token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and consumed_at is null
     and expires_at > now();

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.create_account_deletion_token(uuid) from public;
revoke all on function public.consume_account_deletion_token(uuid, text) from public;
grant execute on function public.create_account_deletion_token(uuid) to authenticated;
grant execute on function public.consume_account_deletion_token(uuid, text) to authenticated;
