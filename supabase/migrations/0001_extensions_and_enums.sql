-- Zybble — 0001: extensions and enums
-- Verified against Supabase Postgres 15/16 (pg 15.8+ / 16.4+) as of 2026-09-25.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gin";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.scrape_job_status as enum (
    'queued', 'starting', 'running', 'paused', 'cancelling',
    'completed', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum (
    'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired', 'incomplete'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_interval as enum ('monthly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_verification_status as enum (
    'unknown', 'pending', 'valid', 'invalid', 'risky', 'accept_all', 'disposable', 'suppressed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum (
    'google_maps', 'manual', 'csv_import', 'api', 'dev_fixture'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum (
    'draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_lead_status as enum (
    'pending', 'scheduled', 'sent', 'delivered', 'opened', 'replied',
    'bounced', 'failed', 'skipped', 'suppressed', 'unsubscribed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mailbox_status as enum ('pending', 'verified', 'rejected', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.automation_status as enum ('draft', 'active', 'paused', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.automation_run_status as enum ('running', 'succeeded', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.export_status as enum ('queued', 'processing', 'ready', 'failed', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'search_completed', 'search_failed', 'subscription_changed', 'payment_failed',
    'payment_succeeded', 'campaign_completed', 'usage_threshold', 'security_event',
    'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_action as enum (
    'create', 'update', 'delete', 'auth', 'billing', 'export', 'admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_role as enum ('user', 'assistant', 'tool', 'system');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
