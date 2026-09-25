# Database

Postgres (via Supabase) is the system of record. Migrations live in
`supabase/migrations/` and are applied in filename order by
`npm run db:migrate`.

## Migration index

| # | File | Contents |
| --- | --- | --- |
| 0001 | `extensions_and_enums` | `pgcrypto`, `citext`, `pg_trgm`, `btree_gin`; every enum type |
| 0002 | `identity` | `profiles`, `workspaces`, `workspace_members`, `handle_new_user()` trigger |
| 0003 | `billing` | `plans`, `subscriptions`, `usage`, `usage_events`, `entitlements`, `billing_events` |
| 0004 | `queue` | `scrape_jobs`, `scrape_job_events`, `workers` |
| 0005 | `leads` | `leads`, `lead_emails`, `lead_phones`, `lead_tags`, `lists`, `list_members`, `searches` |
| 0006 | `outreach` | `mailboxes`, `campaigns`, `campaign_steps`, `campaign_leads`, `suppression_entries`, `email_events` |
| 0007 | `automations` | `automations`, `automation_runs` |
| 0008 | `ai` | `ai_conversations`, `ai_messages` |
| 0009 | `platform` | `notifications`, `audit_logs`, `exports`, `rate_limit_buckets` |
| 0010 | `functions` | `record_usage`, `recompute_entitlements`, `claim_scrape_job`, `heartbeat_scrape_job`, `requeue_orphaned_jobs`, `increment_job_counters`, `complete_scrape_job`, `upsert_lead`, `worker_heartbeat`, `rate_limit_check` |
| 0011 | `rls` | RLS on every user-owned table + all policies |
| 0012 | `realtime` | Broadcast trigger for job counters + `realtime.messages` policy |
| 0013 | `seed_plans` | The seven pricing tiers |
| 0014 | `notification_preferences` | Per-user email preferences |
| 0015 | `account_deletion_tokens` | Single-use, hash-at-rest deletion tokens |

## Core tables

### Identity

`profiles` extends `auth.users` one-to-one. `handle_new_user()` (0002) creates
the profile, a workspace, the owner membership and a free subscription in the
same transaction, so a user is never half-provisioned.

Every tenant-owned row carries `workspace_id`. Membership lives in
`workspace_members` with a role of `owner | admin | member`.

### Billing

- **`plans`** — the price list. `price_cents`, `currency`, `interval`,
  `monthly_leads`, feature flags and the provider's `razorpay_plan_id`.
  The server reads prices from here; the client never supplies one.
- **`subscriptions`** — one per workspace. Stores the Razorpay identifiers and
  the mapped internal `status`.
- **`usage`** — one row per workspace per period (`period_start`, `period_end`).
- **`usage_events`** — the ledger. Unique on `idempotency_key`, which is
  `lead:<lead_id>` for billable leads. This is what makes a duplicate lead
  impossible to bill twice.
- **`entitlements`** — a materialised snapshot recomputed from the
  subscription + usage. The UI reads this; nothing treats it as writable.
- **`billing_events`** — the audit trail. Unique on
  `(provider, provider_event_id)` so a replayed webhook is a no-op.

### Queue

`scrape_jobs` holds the request, the lifecycle state, the real counters and the
lease:

```
status              queued|starting|running|paused|cancelling|completed|failed|cancelled
actual_results      rows returned by the engine
unique_results      new leads persisted
duplicates          matched an existing lead
filtered            dropped by the user's filters
websites_found / phones_found / emails_found / verified_emails
billable_leads      unique_results — what we count against quota
errors              per-row failures
claimed_at / heartbeat_at / lease_expires_at
cancel_requested / pause_requested
```

The unique partial index `scrape_jobs_one_active_per_workspace` prevents a
workspace from running two jobs at once, which is the quota-bypass guard.

`scrape_job_events` is the append-only log behind the activity feed.

### Leads

`leads` is one row per business, keyed by `dedupe_key`. Multiple emails and
phones live in `lead_emails` and `lead_phones` — never denormalised into a
single column, because a business routinely has several.

**Never assume an email is valid.** `email_status` is
`unknown | invalid | risky | valid`, and only a real verification result can
set `valid`. Syntax checks produce at most `unknown`.

### Outreach

`campaign_leads` has a unique constraint on `idempotency_key`
(`campaign:lead:step`), so a retried send can't double-deliver. Each row also
carries a unique `unsubscribe_token`.

`suppression_entries` is checked before every send. Unsubscribing adds the
address here, which suppresses it for **all** campaigns, not just the one.

## Enums

`subscription_status`, `billing_interval`, `scrape_job_status`,
`email_verification_status`, `campaign_status`, `campaign_lead_status`,
`mailbox_status`, `automation_status`, `workspace_role`, `notification_type`,
`export_status`.

## Functions

| Function | Purpose |
| --- | --- |
| `period_start(ts)` | Bucket a timestamp to its monthly period |
| `record_usage(...)` | Idempotent usage increment; returns the new counters |
| `recompute_entitlements(ws)` | Rebuild the entitlement snapshot |
| `claim_scrape_job(worker, …)` | Atomically claim one queued job with a lease |
| `heartbeat_scrape_job(job, worker, …)` | Extend the lease; returns false if the job was cancelled |
| `requeue_orphaned_jobs(limit)` | Return expired leases to `queued`; fail exhausted jobs |
| `increment_job_counters(job, deltas)` | Apply a counter batch |
| `complete_scrape_job(job, status, …)` | Mark terminal + broadcast |
| `upsert_lead(...)` | Dedupe, insert or merge, record usage |
| `worker_heartbeat(...)` | Register/liveness for a worker |
| `rate_limit_check(scope, id, …)` | Token bucket |

All are `SECURITY DEFINER` with `set search_path = ''` and are callable only
by `authenticated` or `service_role` as appropriate.

## Row level security

Enabled on **every** user-owned table (33 tables), with `force row level
security` so the table owner is bound too.

The pattern is consistent:

```sql
-- reads
using (workspace_id in (select public.workspace_ids_for_user()))
-- writes, for admin/owner-only tables
using (public.is_workspace_admin(workspace_id))
```

Helper functions (`workspace_ids_for_user`, `is_workspace_member`,
`is_workspace_admin`, `is_workspace_owner`) are `SECURITY DEFINER` and
`STABLE` so policies can't recurse into themselves.

Special cases:

- **`plans`** — readable by everyone (it's the public price list), writable by
  nobody.
- **`audit_logs`** — admin-only reads; inserts go through `service_role`.
- **`rate_limit_buckets`** — no user policy at all; only the service role
  touches it.
- **`realtime.messages`** — a policy restricts a client to
  `job:<id>` topics for jobs in its own workspace.
- **`account_deletion_tokens`** — no user policy; reachable only through the
  two `SECURITY DEFINER` functions.

`tests/integration/rls.test.ts` exercises this with two real users and
`tests/integration/migrations.test.ts` asserts coverage statically.

## Realtime

A trigger on `scrape_jobs` broadcasts counter changes to topic `job:<id>`.
The channel is *private*, and the `realtime.messages` policy means a client
can only subscribe to topics for its own workspace's jobs.

Broadcast is an optimisation. The database remains the source of truth: the
client re-fetches `/api/jobs/[id]` on mount and on `SUBSCRIBED`, and polls
every 5s (15s once terminal).

## Indexes

- `leads`: trigram `search_vector` for text search; composite
  `(workspace_id, created_at)`; `(workspace_id, dedupe_key)` unique.
- `scrape_jobs`: partial index on non-terminal statuses; `lease_expires_at`
  for the recovery sweep.
- `campaign_leads`: partial index on `next_run_at` where status is
  `pending | scheduled` — the sender's work queue.
- `usage_events`: unique `idempotency_key`.
- `list_members`: unique `(list_id, lead_id)`.

## Backups and retention

Supabase handles point-in-time recovery. Application-side, `data_retention_days`
on `profiles` is the intended retention policy; the nightly sweep is the hook
for it and is deliberately not wired to destructive deletes by default.
