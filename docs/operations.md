# Operations runbook

Day-2 operations: what runs on a schedule, what the logs mean, how to rotate a
secret, and what to do when something breaks. Setup steps live in
`docs/deployment.md`; provider internals in `docs/integrations.md`.

---

## 1. What runs, on what schedule

| Job | Schedule | Source | Auth | Does |
| --- | --- | --- | --- | --- |
| `/api/cron/campaigns` | every 5 min | `vercel.json` | `Bearer $CRON_SECRET` | `sendDueCampaignSteps(100)` — sends due campaign emails |
| `/api/cron/recover` | every 10 min | `vercel.json` | `Bearer $CRON_SECRET` | `requeueOrphanedJobs()` — requeues jobs whose worker lease expired, fails jobs past max attempts |
| `/api/cron/cleanup` | 03:00 UTC daily | `vercel.json` | `Bearer $CRON_SECRET` | Expires finished exports, purges rate-limit buckets older than 24 h, fails scrape jobs stuck far past their lease |
| Worker loop | continuous | `scraper/src/index.ts` | service-role key to Supabase | polls `scrape_jobs` (3 s), claims one job (lease 120 s), heartbeats (20 s), sweeps orphans (60 s) |
| Worker self-recovery | on boot | `scraper/src/index.ts` | — | requeues any job still leased by a dead previous instance |

Cron auth is enforced by `requireCronSecret`; when `CRON_SECRET` is set on the
Vercel project, Vercel sends the `Authorization: Bearer $CRON_SECRET` header
automatically. A missing/wrong secret is a 401 — check the deployment's env if
crons suddenly all fail with 401.

**Deliberately not automated:** deleting leads by `data_retention_days`. That
is destructive and per-workspace, so it belongs behind an explicit admin action
with an audit trail, not a nightly sweep.

## 2. Reading the logs

Everything logs one JSON object per line (`src/lib/logger.ts`) with:

- `request_id` — correlates an HTTP request across services (the response
  header `x-request-id` carries the same value);
- `worker_id`, `job_id` — on worker lines;
- automatic redaction of keys matching `authorization|password|secret|token|
  api-key|cookie|signature|credential|smtp` and of values that look like
  `re_…` / `rzp_…` / `AIza…` / JWTs / `postgres://user:pass@…`.

Signals worth alerting on:

| Log event | Meaning |
| --- | --- |
| `worker.engine_verification_failed` | Worker booted but can't exec the engine — the pod is up but useless; expect `/health` to report `engineReady: false` |
| `worker.browsers_missing` | Playwright browsers not found at `PLAYWRIGHT_BROWSERS_PATH` |
| `cron.recover` with `repaired > 0` | A worker lease expired — investigate the worker |
| `rate_limit.degraded` | Rate limiting failed open because the DB errored — check Supabase health |
| `webhook.invalid_signature` | A request failed signature verification (recorded in `billing_events` / `email_events` with `signature_valid = false`) |
| `email_event.insert_failed`, `suppression.insert_failed` | Resend webhook couldn't write — deliveries are being dropped |
| `http.request_failed` (status ≥ 500) | An unexpected server error; `error_code` names the family |

## 3. Health endpoints

| Endpoint | Where | Tells you |
| --- | --- | --- |
| `GET /api/health` | web app | `status` `ok`/`degraded` by Supabase reachability (a transient DB blip degrades rather than flapping the instance), plus the capability map — no counts or versions |
| `GET /health` (or `/healthz`) on `PORT` (8080) | worker | `engine_ready`, `active_job_id`, job counters, `last_error`; returns **503 while draining** so Railway stops routing to a closing pod |

The worker health server binds `0.0.0.0` and is what Railway's healthcheck
polls (`railway.toml` → `healthcheckPath`). A deploy that can't verify the
engine fails its healthcheck instead of joining rotation.

## 4. Queue & job lifecycle

`scrape_jobs` status machine (worker leases via the `claim_scrape_job` RPC):

```
queued → running → completed
              │→ failed (attempts exhausted; backoff = min(60 min, 2^n × 1 min))
              └→ cancelled (user action; also pause_requested → paused)
```

- A running job holds a **lease** (`WORKER_LEASE_SECONDS`, default 120 s),
  renewed by heartbeat every 20 s.
- If the worker dies, the lease expires and `/api/cron/recover` requeues the
  job; the worker's own 60 s sweep does the same on boot.
- Hard ceiling: one job may run at most `WORKER_MAX_JOB_RUNTIME_MS`
  (default 45 min) before it is failed regardless of lease.
- Every billable lead is a **unique persisted lead** — retries and replays
  never double-bill (`upsert_lead` + usage RPCs).

## 5. Runbooks

### Worker down / no jobs completing

1. Railway → the worker service: is the deployment green? Does `/health` say
   `engineReady: true`?
2. `engineReady: false` → the engine can't exec. Check the deploy logs for
   `worker.engine_verification_failed`; last resort: `WORKER_DEV_MODE=true`
   temporarily so the queue drains with labelled fixtures while you rebuild.
3. Queue connected but idle → check `scrape_jobs` for rows stuck in `queued`;
   run `GET /api/cron/recover` manually (curl with the bearer token) and watch
   for `repaired > 0`.
4. Google Maps returning nothing → `docs/scraper.md` §"operational notes"
   (engine flakiness, proxies, the ~120-results-per-query cap).

### Campaign sends stalled

1. `/api/cron/campaigns` succeeding? (structured logs `cron.campaigns`)
2. Campaign in `running` with due `campaign_leads` but no sends → check the
   mailbox: `sent_today` vs `daily_send_limit`, and `mailboxes.status`.
3. Recipients bouncing en masse → `email_events` + `campaign_leads.status`
   (`bounced`/`suppressed` are terminal; suppression is workspace-wide).
4. Resend returning 403 → sending domain no longer verified.

### Webhook failures

- Razorpay: rows in `billing_events` with `signature_valid = false` mean a
  request was rejected — if Razorpay is retrying a *valid* event (status 500
  from us), fix the handler and let it retry; the event-id guard makes replays
  safe. A subscription never activates from the browser, so a lost webhook
  simply means the subscription stays inactive until the retry lands.
- Resend: rows in `email_events` with `signature_valid = false`, or a missing
  `RESEND_WEBHOOK_SECRET` (route then 401s everything) — re-set the secret from
  the Resend dashboard and Resend will retry failed deliveries.

### Supabase degraded

Rate limiting **fails open** (logged as `rate_limit.degraded`) rather than
blocking all traffic; everything else fails closed. If the pooler is
saturated, the worker's Supabase RPCs will error and jobs stay queued — the
lease/recovery machinery means nothing is lost.

## 6. Secret rotation

All of these are server-side only; none ever reach the browser. Rotating is a
value change in the provider dashboard + the deployment env, then redeploy.

| Secret | Rotate by | Consequence window |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API → regenerate | web + worker both need the new value; sessions unaffected (they use the anon key) |
| `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard; webhooks can hold **two** secrets during rotation | in-flight checkout attempts fail during the gap; webhooks retry |
| `RESEND_API_KEY` | Resend dashboard | sends fail (logged) until redeployed; campaigns retry via backoff |
| `RESEND_WEBHOOK_SECRET` | Resend webhook settings (Svix accepts multiple signatures during rotation) | none — overlapping signatures are supported |
| `GEMINI_API_KEY` | Google AI Studio | AI errors are user-visible only in the assistant |
| `MAILBOX_ENCRYPTION_KEY` | **Special** — decrypts SMTP passwords at rest. Rotating means re-entering each mailbox's SMTP password afterwards; there is no transparent re-encryption | mailboxes can't send until re-entered |
| `CRON_SECRET` | Change the Vercel env var; Vercel's cron picks it up on the next deploy | cron 401s between save and deploy |
| Database password | Supabase Settings → Database | update `SUPABASE_DB_URL` wherever migrations run |

Every commit is scannable: `npm run secrets:check` (staged files) or
`npm run secrets:check -- --all`. See `docs/security.md` §1.

## 7. Backups & recovery

- Supabase takes automatic daily backups (paid plans) — verify the schedule on
  your tier; take a manual backup before any manual SQL.
- Migrations are the schema source of truth; a fresh project is
  `npm run db:migrate` away from complete.
- Lead/campaign/billing data lives in Postgres only — there is no secondary
  store to reconcile after a restore.
- The queue is recoverable by construction: unacknowledged jobs are requeued
  from expired leases, and the recovery sweep only touches jobs whose lease
  has already expired — a restored database replays nothing on its own.

## 8. Cost levers

- **Scraping**: `SCRAPER_CONCURRENCY`, `SCRAPER_PAGES_PER_BROWSER` and
  `SCRAPER_DEPTH` trade Railway CPU time against result freshness; quotas on
  the plan side (docs/billing.md) cap how much any tenant can spend you.
- **AI**: `GEMINI_MODEL` (flash-tier default), the pendingActions confirmation
  gate, and per-user rate limits (`ai:chat` 30/min) — details in `docs/ai.md`.
- **Email**: mailbox `daily_send_limit` (per mailbox, worker-enforced) and the
  suppression list keep volume (and Resend spend) predictable.
