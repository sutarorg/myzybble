-- Zybble — 0012: Realtime
--
-- Supabase recommends Broadcast over Postgres Changes for scalable realtime
-- (§15). We broadcast scrape-job row changes onto a per-job private topic
-- (`job:<id>`), which keeps payloads small, honours Realtime Authorization via
-- RLS on `realtime.messages`, and avoids WAL pressure from a hot table.
--
-- Realtime is an enhancement only: the UI always re-reads authoritative state
-- from the database on mount and after reconnect.

do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages not present (local Postgres); skipping broadcast triggers.';
    return;
  end if;
end $$;

create or replace function public.broadcast_scrape_job_changes()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  if to_regclass('realtime.messages') is null then
    return null;
  end if;

  perform realtime.broadcast_changes(
    'job:' || coalesce(new.id, old.id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    new,
    old
  );

  return null;
end;
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop trigger if exists scrape_jobs_broadcast on public.scrape_jobs;
    create trigger scrape_jobs_broadcast
      after insert or update or delete on public.scrape_jobs
      for each row execute function public.broadcast_scrape_job_changes();
  end if;
end $$;

-- Realtime Authorization: only members of the job's workspace may join a
-- private `job:<id>` channel. Realtime evaluates this policy on subscribe.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    alter table realtime.messages enable row level security;

    drop policy if exists zybble_realtime_job_access on realtime.messages;
    create policy zybble_realtime_job_access on realtime.messages
      for select using (
        -- topic format: job:<uuid>
        position('job:' in realtime.messages.topic) = 1
        and public.is_workspace_member(
          (
            select j.workspace_id
              from public.scrape_jobs j
             where j.id::text = substring(realtime.messages.topic from 5)
             limit 1
          )
        )
      );
  end if;
exception when others then
  raise notice 'Could not create realtime authorization policy: %', sqlerrm;
end $$;
