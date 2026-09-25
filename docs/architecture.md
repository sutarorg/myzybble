# Architecture

## Shape of the system

```
┌──────────────┐      ┌───────────────────────────────────┐
│   Browser    │      │  Next.js 16 on Vercel             │
│              │ HTTPS│                                   │
│  Marketing   │─────▶│  (marketing)/  static + metadata  │
│  Auth pages  │      │  (auth)/       server actions     │
│  App shell   │      │  (app)/        RSC + client       │
│  Realtime    │◀────▶│  api/*         route handlers     │
└──────────────┘  WS  └──────────────┬────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
      ┌───────────────┐     ┌────────────────┐     ┌──────────────┐
      │ Supabase Auth │     │  Postgres      │     │  Providers   │
      │ + RLS         │     │  (system of    │     │  Razorpay    │
      └───────────────┘     │   record)      │     │  Resend      │
      ┌───────────────┐     │                │     │  Gemini      │
      │ Realtime      │────▶│  scrape_jobs   │     └──────────────┘
      │ Broadcast     │     │  leads, usage  │
      └───────────────┘     └───────▲────────┘
                                    │ RPC
                            ┌───────┴────────┐
                            │ Worker (Railway)│
                            │ Playwright +    │
                            │ pinned engine   │
                            └────────────────┘
```

Three deployables, one database. Postgres is the single source of truth: the
queue, the counters, the usage ledger and the entitlement snapshot all live
there, so no component has to reconcile state with another.

## Why nothing scrapes in a request handler

The upstream engine is Playwright-driven. A single job runs one or more
Chromium instances for minutes at a time, needs a browser pool, and is the
one part of the system that can fail in ways we can't predict (Google layout
changes, captchas, proxy exhaustion).

That makes it a poor fit for a Vercel function: it would exceed the execution
limit, hold memory for the whole duration, and turn a transient Google error
into a 500 in the user's face.

So scraping happens **only** on the Railway worker. The Next.js app writes a
job row and gets out of the way. Nothing in `src/app/api` invokes the engine,
and `scraper/` is never imported by application code.

## Layers

### `src/app` — routes

Three route groups:

- **`(marketing)`** — the public site. Preserved from the original Vite SPA:
  same components, same tokens, same animations, now with per-route metadata.
- **`(auth)`** — login, signup, password reset, and the OAuth callback.
- **`(app)`** — the authenticated product. Its layout calls
  `requireAuthContext()` server-side on every request and loads the entitlement
  row, so a protected page cannot render with a stale or client-supplied plan.

### `src/server` — the server boundary

- `auth.ts` — resolves the session, the workspace membership and the role.
  Every route that needs a user calls `requireAuthContext()`; nothing reads a
  `userId` or `workspaceId` from a request body.
- `api.ts` — `withRoute()` wraps every handler so success and failure produce
  the same shape: a request id, a sanitised error, structured logs. It also
  enforces the origin check for CSRF and a request-size cap.
- `rate-limit.ts` — Postgres-backed token buckets. Fails *open* with a loud
  log line rather than locking users out during a database blip.
- `services/*` — the typed domain boundary. One module per domain (leads,
  searches, billing, campaigns, automations, ai, email, exports, usage,
  notifications, audit, lists, settings).

### `src/lib` — pure logic

No I/O. Normalisation, dedupe, CSV, validation, personalisation, logging,
error shapes, env access. This is where the correctness lives, and it's what
the unit tests cover.

### `scraper/` — the worker

Four isolated concerns: `adapter/` (the only code that knows the upstream CLI),
`parsers/` (incremental JSONL), `normalization/` (place → lead),
`persistence/` (claim, heartbeat, counters, upsert). Upgrading the engine is
meant to be a change confined to `adapter/` plus `parsers/`.

## Data flow: a search, end to end

1. **Create.** `POST /api/searches` validates input, calls `assertCapacity()`
   (server-side quota gate), and inserts a `searches` row plus a `scrape_jobs`
   row in state `queued`. A unique partial index
   (`scrape_jobs_one_active_per_workspace`) makes a second concurrent job
   impossible — that's the quota-bypass guard from §10.

2. **Claim.** The worker polls `claim_scrape_job()`, which selects with
   `FOR UPDATE SKIP LOCKED` and stamps `lease_expires_at`. Two workers can run
   against the same database without ever taking the same job.

3. **Run.** The worker fans out over the keyword × location matrix (Google caps
   a single query at ~120 results), reads results incrementally, normalises
   each place, applies the filters the upstream CLI doesn't support, and
   persists through `upsert_lead()`.

4. **Count.** Counters are flushed to Postgres every few seconds. The browser
   sees them via Realtime Broadcast on `job:<id>`; the database stays the
   source of truth, so a refresh recovers exactly the same numbers.

5. **Finish.** `complete_scrape_job()` marks the job terminal, which fires
   `broadcast_scrape_job_changes()`, writes a notification, and runs
   `onJobTerminal()` → automations.

## Concurrency and recovery

| Scenario | Handling |
| --- | --- |
| Worker crashes mid-job | Lease expires → `requeue_orphaned_jobs()` (worker boot + `/api/cron/recover`) returns it to `queued` |
| Job exceeds `max_attempts` | Marked `failed` with the last error code |
| Two workers, one queue | `FOR UPDATE SKIP LOCKED` |
| Graceful shutdown | SIGTERM sets draining, finishes the current batch, requeues the job |
| User cancels | `cancel_requested` is polled between batches; the worker exits cleanly and the job lands in `cancelled` |
| Duplicate delivery of a webhook | Unique index on `(provider, provider_event_id)` |
| Campaign retried | Idempotency key per `(campaign, lead, step)` |

## Where correctness is enforced

Twice, deliberately:

- **Quota** — checked before job creation, continuously in the worker, and
  again at persistence time inside `upsert_lead()`.
- **Authorisation** — middleware, `requireAuthContext()`, service-level
  `workspace_id` filters, *and* RLS policies.
- **Plan/price** — read from the `plans` table; the client can only request a
  plan code, never assert a price, quota or status.
- **Subscription activation** — only the signature-verified webhook. The
  browser's "payment succeeded" event is used solely to start polling our own
  subscription endpoint.

## What we deliberately did not build

- **No Redis.** Postgres handles the queue, rate limiting and usage accounting.
  Adding Redis would be a second state store to keep consistent for no gain at
  this scale.
- **No public scraping endpoint.** There is no unauthenticated HTTP route that
  starts a scrape. Jobs are created by authenticated users and consumed by an
  authenticated worker.
- **No background threads in the app.** Sending and scraping are driven by cron
  or the worker, never by a request.
