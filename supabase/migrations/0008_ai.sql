-- Zybble — 0008: AI assistant conversations and messages
--
-- The Gemini API key never reaches the browser; all orchestration happens in
-- server routes under /api/ai (§20).

create table if not exists public.ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  title         text not null default 'New conversation',
  model         text not null default 'gemini-3.8-flash',
  message_count integer not null default 0,
  -- Optional context the assistant may read (a list, a lead, a search).
  context       jsonb not null default '{}'::jsonb,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ai_conversations_workspace_idx
  on public.ai_conversations (workspace_id, updated_at desc);

create table if not exists public.ai_messages (
  id             uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  role           public.ai_role not null,
  content        text not null default '',
  -- Tool calls the model requested, and the tool results fed back.
  tool_calls     jsonb,
  tool_results   jsonb,
  -- Distinguishes stored data from model output (§20).
  provenance     text not null default 'model'
    check (provenance in ('stored_data', 'model', 'system', 'user')),
  tokens_in      integer,
  tokens_out     integer,
  latency_ms     integer,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.tg_set_updated_at();
