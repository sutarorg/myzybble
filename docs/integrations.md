# Integrations reference

What each provider does in zybble, exactly which environment variables it
needs, and the behaviour that matters operationally. Step-by-step account
setup is in `docs/deployment.md`; this page is the reference.

Every server-side variable is read through `src/lib/env.ts`, which validates
the whole set with zod at boot and is marked `server-only` — importing it from
a Client Component is a build error. The capability map
(`capabilities.supabase | supabaseAdmin | razorpay | resend | gemini | worker`)
drives the "configured / not configured" surfaces in `/settings/integrations`,
and `requireCapability()` turns a missing provider into an explicit 503 rather
than a silent fake.

---

## Supabase — database, auth, realtime

| Variable | Exposure |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public (RLS is the boundary) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only, bypasses RLS** |
| `SUPABASE_DB_URL` | server-only, migrations only |

- Browser/server auth goes through `@supabase/ssr` `createServerClient` with
  the cookie `getAll`/`setAll` adapter; identity is always established with
  `getUser()` (validates the JWT), never `getSession()`.
- The **service-role client** (`src/lib/supabase/admin.ts`) is used only where
  the caller's own RLS context is not the right boundary: worker persistence,
  webhook handlers, exports, usage accounting, audit writes, notifications.
- Tenant isolation is RLS (`docs/database.md`), with SECURITY DEFINER
  functions for the queue and the two-step deletion tokens.
- Realtime (`0012_realtime.sql`) powers live search/campaign updates on app
  pages.

## Razorpay — subscriptions & payments

| Variable | Exposure |
| --- | --- |
| `RAZORPAY_KEY_ID` | server-only (checkout is created server-side) |
| `RAZORPAY_KEY_SECRET` | **server-only** |
| `RAZORPAY_WEBHOOK_SECRET` | **server-only**, webhook signature |

- Checkout is created by `/api/billing/checkout` with the server SDK
  (`razorpay` 2.9.x); the browser only opens Razorpay's widget with the
  order/subscription id it is handed. The six plans ($19/5k … $199/100k + Free)
  live in the `plans` table; the client never computes price or quota.
- **Webhook** `/api/webhooks/razorpay`: raw body → HMAC-SHA256 **hex** in
  `X-Razorpay-Signature` keyed by the *webhook secret* → record in
  `billing_events` (dedupe on `X-Razorpay-Event-Id`) → replay guard → handler
  → mark processed. Invalid signature ⇒ 401, recorded, never applied. Handled
  events: `payment.captured|authorized|failed`, `subscription.activated|
  charged|authenticated|pending|halted|paused|resumed|cancelled|completed`.
  Status mapping fails closed to `incomplete` on anything unrecognised.
- A browser "payment succeeded" message never activates anything — only the
  verified webhook does (`docs/billing.md` has the full sequence).
- International payments must be activated on the Razorpay account; it is an
  account setting, not a code path.

## Resend — transactional + campaign email

| Variable | Exposure |
| --- | --- |
| `RESEND_API_KEY` | **server-only** |
| `RESEND_WEBHOOK_SECRET` | **server-only**, Svix signature |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | server-only sender identity |
| `RESEND_VERIFIED_DOMAINS` | server-only, optional allowlist |

- One client module (`src/server/services/email.ts`) sends everything:
  transactional templates (welcome, verification, password reset, search
  done/failed, billing receipts, usage warnings) and campaign sends. The SDK
  returns `{ data, error }` and never throws — callers handle errors
  explicitly.
- **Idempotency keys** are sent for every send (format
  `<event-type>/<entity-id>`, ≤ 256 chars, 24 h provider-side window), with a
  time-bucket scheme for digest-style notifications so a burst sends once —
  table in `docs/email.md`.
- **Webhook** `/api/webhooks/resend`: Svix signature (headers `svix-id`,
  `svix-timestamp`, `svix-signature`; base64 HMAC-SHA256 over
  `<id>.<timestamp>.<raw body>`; `whsec_`-prefixed key; ±5 min window; any of
  several space-separated `v1,` signatures matches). Dedupe on the Svix id in
  `email_events`; bounces/complaints/suppressions write **workspace-wide**
  suppression entries; delivered/opened update `campaign_leads` with status
  guards so late events never overwrite terminal ones. Implemented in
  `src/server/webhooks/svix.ts` + `src/server/services/email-events.ts`.
- `onboarding@resend.dev` is sandbox-only — production requires a verified
  domain in `EMAIL_FROM`.

## Google Gemini — AI assistant

| Variable | Exposure |
| --- | --- |
| `GEMINI_API_KEY` | **server-only** |
| `GEMINI_MODEL` | server-only, default `gemini-3.8-flash` |

- SDK `@google/genai`; the key is imported only in server modules.
- The assistant (`runChat`) resolves the workspace **from the session**, so a
  prompt can never reach another tenant's data; tool answers derived from
  stored data are badged as such, model prose is labelled separately.
- Expensive actions never execute on the model's word: they come back as
  `pendingActions` and run only when the user clicks confirm on
  `/api/ai/confirm` (whose action id doubles as the idempotency key).
- A fallback chain of GA models handles capacity errors; cost control is rate
  limit (`ai:chat` 30/min/user) + message length cap (4 000 chars). Full
  design: `docs/ai.md`.

## Railway — scraping worker

| Variable (worker service) | Exposure |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | worker → Supabase, service role |
| `WORKER_*`, `SCRAPER_*`, `PLAYWRIGHT_BROWSERS_PATH`, `PORT` | worker tuning, `scraper/src/config.ts` |
| `WORKER_BASE_URL`, `WORKER_SHARED_SECRET` | web-app side: worker health surface |

- The worker is a **queue consumer**: it polls `scrape_jobs`, claims via the
  `claim_scrape_job` RPC (atomic, lease-based), runs the pinned engine, and
  persists through `upsert_lead` / `complete_scrape_job`. No inbound scraping
  endpoint exists; the database is the only interface.
- Health: `/health` on `PORT` (8080), wired as the Railway healthcheck via
  `railway.toml`; reports `engineReady` and queue connectivity.
- Graceful drain: SIGTERM → stop claiming → finish in-flight job → exit within
  `WORKER_DRAIN_TIMEOUT_MS` (30 s). Railway's SIGTERM→SIGKILL buffer covers
  this; anything that overruns is requeued by lease expiry.
- The engine is `gosom/google-maps-scraper` **v1.18.1** — pin rationale,
  verified flags and the upgrade procedure are in `docs/scraper.md`.

## Vercel — hosting + cron

| Variable | Exposure |
| --- | --- |
| `CRON_SECRET` | server-only bearer token for `/api/cron/*` |

- `vercel.json` defines the three crons; Vercel sends
  `Authorization: Bearer $CRON_SECRET` when the variable is set.
- Security headers, Server Action body limit (1 MB) and
  `serverExternalPackages` (`postgres`, `razorpay`, `@google/genai`) all come
  from `next.config.ts`.
