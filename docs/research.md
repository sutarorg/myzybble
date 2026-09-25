# Research record

What was verified from official documentation **before** building, and the
decisions it drove. Research date: **2026-09-25** (re-verify anything you
change). Sources were the providers' official docs and the actual upstream
source — not tutorials, not model memory — because three of the "well-known
facts" below turned out to be wrong or outdated.

---

## 1. Decisions at a glance

| Area | Finding (verified) | Decision it drove |
| --- | --- | --- |
| Supabase auth on Next.js | `@supabase/auth-helpers` is deprecated; the supported path is `@supabase/ssr` + `createServerClient` with the cookie `getAll`/`setAll` adapter. `getSession()` does **not** validate the JWT; `getUser()` and `getClaims()` do. Middleware must call `getUser()` to rotate refresh tokens and must write cookies back to request **and** response. | `src/lib/supabase/*.ts` built on `@supabase/ssr`; every server identity check is `getUser()`; `middleware.ts` refreshes sessions on every navigation; `/auth/callback` exchanges `?code` via `exchangeCodeForSession`, `/auth/confirm` verifies `token_hash`+`type` via `verifyOtp`. |
| Razorpay webhooks | Signature = HMAC-SHA256 **hex over the raw request body**, in `X-Razorpay-Signature`, keyed by the **webhook secret** — *not* the API key secret, and *not* computed over re-serialized JSON. Payment signatures are a different check (`order_id|payment_id` with `key_secret`). International payments require account-level activation. | `src/app/api/webhooks/razorpay/route.ts` reads `request.text()` before any parse, verifies hex HMAC with the webhook secret, records then applies, dedupes on the event id. |
| Razorpay subscriptions | Server-created subscriptions; statuses map loosely to app states. | Status mapping is server-side and **fails closed to `incomplete`** on unknown statuses; plans are DB rows the client only reads. |
| Resend webhooks | Delivered through **Svix**: `svix-id` / `svix-timestamp` / `svix-signature`, base64 HMAC-SHA256 over `<id>.<timestamp>.<raw body>` with a `whsec_` (base64) key, ±5 min window, multiple space-separated `v1,` signatures (rotation). Replay dedupe belongs on the Svix id. | `src/server/webhooks/svix.ts` implements the construction exactly (unit-tested against node:crypto references); route dedupes on `svix-id` in `email_events`. |
| Resend sending | Idempotency keys supported on `POST /emails` and `/emails/batch` (≤ 256 chars, 24 h window; batch ≤ 100). SDK returns `{data, error}` and never throws. 403 = domain not verified. `onboarding@resend.dev` is sandbox-only. Retry-worthy statuses are 429/500 only. | Every send carries an idempotency key (`<event-type>/<entity-id>`, time-bucketed for digests); callers handle `{error}` explicitly; `EMAIL_FROM` must be a verified domain. |
| Gemini | Current SDK is `@google/genai` (2.x); function calling via `config.tools[].functionDeclarations`, model replies surface as `response.functionCalls`, and the follow-up turn appends `{functionResponse}` parts. Production docs point at the Gemini 3 flash tier (`gemini-3.8-flash`). Maps grounding + search + function calling combine in Gemini 3. | `@google/genai`, default model `gemini-3.8-flash` with a GA fallback chain; tool results → `pendingActions` that only execute after an explicit user confirmation (`/api/ai/confirm`, id = idempotency key). |
| gosom/google-maps-scraper | v1.18.1 (commit `549e4b5e…`), Go 1.26.6+, Playwright driver by default. CLI has **no** min-rating / require-website / require-phone flags. Google Maps caps ~**120 results per query**. 2026 flakiness reports around `review_count` fields and Playwright driver downloads. | Pin the exact version (`scraper/PIN.md`); filters are applied **in the worker**; bigger limits are fanned out over a keyword×location query matrix (`buildQueries`); browsers pre-installed at image build (`Dockerfile.worker`). |
| Railway | Services deploy from a Dockerfile with `railway.toml` config; `healthcheckPath`/`healthcheckTimeout` gate deploys; `RAILWAY_REPLICA_ID`/`RAILWAY_REPLICA_REGION` are injected; SIGTERM→SIGKILL buffer is configurable via drain seconds. | `Dockerfile.worker` + `railway.toml`; worker health server on `PORT` reports `engineReady`; 30 s graceful drain fits Railway's default buffer. |
| Vercel | Crons are declared in `vercel.json`; when `CRON_SECRET` is set, Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. | Three crons (`campaigns` / 5 min, `recover` / 10 min, `cleanup` / daily) with `requireCronSecret` on each route. |
| Queueing | No evidence a Redis-backed queue is needed at this scale: one atomic Postgres RPC (`claim_scrape_job`) + leases + heartbeats gives exactly-once-start semantics, and recovery is a cron sweep. | **No Redis.** Supabase Postgres is the system of record *and* the queue; the worker polls it. One less provider, one less failure mode. |

## 2. Verified versions (from the lockfile, 2026-09-25)

| Package | Version | Role |
| --- | --- | --- |
| `next` | 16.3.6 | App Router, route handlers, middleware, Server Actions |
| `react` / `react-dom` | 19.3.0 | UI |
| `@supabase/ssr` / `@supabase/supabase-js` | 0.12.7 / 2.117.1 | auth + DB client |
| `razorpay` | 2.9.8 | subscriptions + checkout (server) |
| `resend` | 6.29.0 | email (server) |
| `@google/genai` | 2.24.0 | AI assistant (server) |
| `postgres` | 3.4.9 | migration runner (`scripts/migrate.ts`) |
| `zod` | 4.6.5 | validation at every boundary |
| `vitest` / `typescript` / `tsx` | 5.0.1 / 5.9.3 / 4.20.6 | test / types / worker runner |
| engine | `gosom/google-maps-scraper` v1.18.1 @ `549e4b5e61c7103685ef8392f246ebdba783ed03` | scraping (pinned) |

## 3. Rejected options (and why)

- **Redis / BullMQ for the job queue** — the Postgres lease pattern covers the
  requirement (atomic claim, crash recovery, bounded retries) without a new
  provider. Revisit only if claim contention becomes measurable.
- **Scraping in Vercel functions or the browser** — the engine needs Playwright
  and long runtimes; Vercel request handlers are neither. The worker exists so
  the web tier stays stateless and fast.
- **`getSession()` for auth checks** — it does not validate the JWT; a forged
  or stale session would pass. `getUser()` everywhere.
- **Trusting the browser's "payment succeeded"** — Razorpay's success redirect
  is user-controlled; only the signature-verified webhook mutates subscription
  state.
- **Trusting an email because it exists** — email validity is stored as a
  separate verification state (`email_verification_status`), never inferred
  from presence.
- **Upstream CLI flags that don't exist** — inventing `-min-rating`-style flags
  would silently return unfiltered data; the same filters are applied in the
  worker where they are testable.

## 4. Known risks we carry

- **Upstream engine flakiness (2026)**: `review_count` regressions and
  Playwright driver download 404s are reported upstream. Mitigations: exact
  pin, browsers baked into the image, `-exit-on-inactivity`, the job runtime
  ceiling and lease recovery.
- **~120 results per Google Maps query** — a user asking for 5 000 "restaurants
  in Mumbai" gets a fan-out across keyword×location lines; result volume is
  capped by plan quota, and the UI never shows fake progress.
- **Razorpay international payments** are an account activation, not a code
  switch — enabling them is an operator task (docs/deployment.md §4).
- **CSP keeps `'unsafe-inline' 'unsafe-eval'` in script-src** (see
  `docs/security.md` §12 for the verbatim policy). Tightening to a nonce-based
  policy is tracked as future work, not silently claimed as done — the current
  policy must not break Razorpay's checkout widget or Next.js hydration, and
  that compatibility is easier to verify incrementally than to assert.
