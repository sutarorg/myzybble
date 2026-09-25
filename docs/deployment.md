# Deployment

 Zybble is three deployment targets, each owned by the provider it runs on:

| Piece | Runs on | What it is |
| --- | --- | --- |
| Web app + API | **Vercel** | Next.js 16 App Router; route handlers, Server Actions, cron triggers |
| Postgres + auth + realtime | **Supabase** | System of record; RLS is the tenant boundary |
| Scraping worker | **Railway** | Long-lived queue consumer; drives the pinned Google Maps engine |

The web app and the worker share this repository but never share a runtime:
Vercel deploys the Next.js app from the repo root (it ignores
`Dockerfile.worker` and `railway.toml`), and the Railway worker service builds
`Dockerfile.worker`. The only channel between them is the Supabase database —
the worker polls the `scrape_jobs` queue; it has no inbound scraping endpoint.

---

## 0. Environments

| | Development | Preview | Production |
| --- | --- | --- | --- |
| Where | `npm run dev` (localhost:3000) | Vercel preview deployment | Vercel production |
| Data | Local `.env.local` → a dev Supabase project, or `NEXT_PUBLIC_DEV_MODE=true` fixtures | Shared staging Supabase project (recommended) | Production Supabase project |
| Payments | Razorpay **test** keys | Razorpay **test** keys | Razorpay **live** keys |
| Email | Resend sandbox (`onboarding@resend.dev`) | Resend + verified test domain | Resend + verified production domain |
| Scraping | `WORKER_DEV_MODE=true` (fixtures, no engine) | Real worker, test Supabase | Real worker |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | The preview URL | `https://<your-domain>` |

Rules that hold in every environment:

- **Every secret is server-side.** The browser receives only `NEXT_PUBLIC_*`
  values. `src/lib/env.ts` is `server-only` — importing it from a Client
  Component is a build error.
- **Dev-mode fixtures are clearly labelled** (`NEXT_PUBLIC_DEV_MODE` only takes
  effect when `NODE_ENV=development`) and never run in production.
- Client never determines plan, quota, price or subscription status — the
  server does (see `docs/billing.md`).

---

## 1. Supabase (database, auth, realtime)

1. Create two projects: `zybble-staging` and `zybble-production` (or just
   production if you accept preview running against it).
2. **Apply migrations** from your machine:
   ```
   # connection string: Project settings → Database → Connection string
   # (session pooler URI). Put it in .env.local as SUPABASE_DB_URL.
   npm run db:migrate            # applies supabase/migrations/*.sql in order
   npm run db:migrate -- --status  # inspect without applying
   ```
   The runner tracks applied files in `schema_migrations` and is idempotent;
   each file also runs in one transaction. (`supabase db push` works too — the
   SQL is written to be re-runnable either way.)
3. **Auth settings** (Dashboard → Authentication):
   - Site URL: your production `NEXT_PUBLIC_SITE_URL`.
   - Redirect URLs: add `https://<your-domain>/auth/callback`,
     `https://<your-domain>/auth/confirm`, and the same two on the preview
     domain(s).
   - Email verification: enable "Confirm email". The templates should link to
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` —
     `/auth/confirm` exchanges the hash via `verifyOtp` and redirects.
4. **Keys** (Settings → API): copy the anon key (public) and the service-role
   key (server env only — it bypasses RLS).

## 2. Vercel (web app + API + cron)

1. Import the repository; framework preset **Next.js** (build `next build`,
   output is auto-detected). Root directory: repo root.
2. Set environment variables per environment (Production / Preview):

   | Variable | Notes |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | Canonical origin; also the CSRF origin allowlist entry |
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public by design |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only; webhooks, exports, usage |
   | `SUPABASE_DB_URL` | Only needed if you run migrations from Vercel (you normally don't) |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Test keys for preview, live for production |
   | `RAZORPAY_WEBHOOK_SECRET` | The **webhook** secret, not the key secret |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | `EMAIL_FROM` must be on a verified domain |
   | `RESEND_WEBHOOK_SECRET` | Svix signing secret (`whsec_…`) |
   | `RESEND_VERIFIED_DOMAINS` | Optional allowlist surfaced in `/settings/integrations` |
   | `GEMINI_API_KEY`, `GEMINI_MODEL` | Key is server-only; model defaults to `gemini-3.8-flash` |
   | `MAILBOX_ENCRYPTION_KEY` | ≥ 32 chars; encrypts SMTP passwords at rest |
   | `WORKER_BASE_URL`, `WORKER_SHARED_SECRET` | Worker health surface used by `/settings/integrations` |
   | `CRON_SECRET` | Bearer token Vercel sends to `/api/cron/*` |

   The full list with commentary lives in `.env.example`. Nothing else is read.
3. **Cron jobs** come from `vercel.json` and are created automatically on
   deploy: `/api/cron/campaigns` every 5 min, `/api/cron/recover` every 10 min,
   `/api/cron/cleanup` daily at 03:00 UTC. When `CRON_SECRET` is set on the
   project, Vercel sends `Authorization: Bearer $CRON_SECRET` with every cron
   request, which is exactly what `requireCronSecret` checks.
4. **Domains**: add the domain, keep the suggested DNS records. HSTS, CSP and
   the rest of the header set ship from `next.config.ts` — nothing to configure.

## 3. Railway (scraping worker)

1. New service → **Deploy from repo**, root directory = repo root. Railway
   reads `railway.toml`, which selects `Dockerfile.worker`, sets the
   healthcheck to `GET /health` (300 s timeout — the first boot installs
   nothing but does verify the engine) and restarts on failure.
2. Service variables:

   | Variable | Notes |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Required; the worker's only interface is the database |
   | `WORKER_ID` | Optional; defaults to `RAILWAY_REPLICA_ID` |
   | `SCRAPER_BIN` | Defaults to `/usr/local/bin/google-maps-scraper` (baked into the image) |
   | `PLAYWRIGHT_BROWSERS_PATH` | Defaults to `/opt/ms-playwright` (baked into the image) |
   | `SCRAPER_CONCURRENCY`, `SCRAPER_PAGES_PER_BROWSER`, `SCRAPER_DEPTH`, `SCRAPER_INACTIVITY`, `SCRAPER_PROXIES` | Engine tuning; see `docs/scraper.md` |
   | `WORKER_POLL_INTERVAL_MS`, `WORKER_HEARTBEAT_INTERVAL_MS`, `WORKER_LEASE_SECONDS`, `WORKER_RECOVERY_INTERVAL_MS`, `WORKER_MAX_JOB_RUNTIME_MS`, `WORKER_DRAIN_TIMEOUT_MS` | Queue tuning; defaults in `scraper/src/config.ts` |
   | `WORKER_DEV_MODE` | Must be `false`/unset in production — it swaps the engine for fixtures |

3. **Networking**: the worker only *needs* outbound access to Supabase (and
   Google Maps via the engine). Exposing the health port publicly is optional;
   if you expose it, set `WORKER_BASE_URL` + `WORKER_SHARED_SECRET` on the web
   app so `/settings/integrations` can show worker status.
4. **Scaling**: keep 1 replica unless you've deliberately decided to run
   concurrent claimers (leases make it safe; mailbox daily caps are the
   throughput limit anyway). See `railway.toml` for the reasoning.
5. **Upgrades of the engine** follow the procedure in `docs/scraper.md` — the
   version is an `ARG` in `Dockerfile.worker`, pinned in `scraper/PIN.md`.

## 4. Razorpay (payments)

1. Dashboard → API keys: generate test keys for staging, live keys for
   production. Activate **international payments** on the account only if you
   intend to charge non-INR customers — it is an account-level setting, not a
   code path.
2. Products → Subscriptions: the six plans are **seeded in the database**
   (`0013_seed_plans.sql`) with their `razorpay_plan_id` column filled from the
   dashboard after you create matching plans there. The client never prices
   anything; `/api/billing/checkout` creates the subscription server-side.
3. Settings → Webhooks: add `https://<your-domain>/api/webhooks/razorpay` with
   events `payment.captured`, `payment.failed`, `subscription.*`; set the
   secret → `RAZORPAY_WEBHOOK_SECRET`. The route verifies an HMAC-SHA256 hex
   signature over the raw body and dedupes on the event id — details and the
   full event table in `docs/billing.md`.

## 5. Resend (transactional + campaign email)

1. Domains → add your sending domain, add the DKIM/SPF records, wait for
   "Verified". Set `EMAIL_FROM` to an address on that domain.
2. API keys → create a sending key → `RESEND_API_KEY` (server-only).
3. Webhooks → add `https://<your-domain>/api/webhooks/resend` with the email
   events (`email.sent`, `email.delivered`, `email.opened`, `email.clicked`,
   `email.bounced`, `email.complained`, `email.failed`,
   `email.delivery_delayed`, `email.suppressed`); copy the signing secret
   (`whsec_…`) → `RESEND_WEBHOOK_SECRET`. The route verifies the Svix
   signature over the raw body, dedupes on the Svix id, and turns bounces and
   complaints into workspace-wide suppression entries.
4. The default `onboarding@resend.dev` sender is sandbox-only: it can deliver
   to your own address and nowhere else. Do not ship with it.

## 6. Gemini (AI assistant)

1. Google AI Studio → create an API key → `GEMINI_API_KEY` (server-only;
   imported exclusively from server modules through `src/lib/env.ts`).
2. `GEMINI_MODEL` defaults to `gemini-3.8-flash`; the assistant falls back
   through a chain of older GA models on capacity errors (see `docs/ai.md`).
3. No webhook or callback exists for Gemini — it is request/response only.

## 7. Launch checklist

- [ ] `npm run db:migrate -- --status` reports all 15 migrations applied on the production database.
- [ ] `npm run build` passes; `npm test` passes; `npm run worker:typecheck` passes.
- [ ] `npm run secrets:check -- --all` is clean; no secret has ever been committed.
- [ ] Signup → verify → login works on the production domain (check the email link lands on `/auth/confirm`).
- [ ] Test-mode Razorpay checkout + webhook: subscription activates **only** via the webhook, never from the browser redirect.
- [ ] `/api/webhooks/razorpay` and `/api/webhooks/resend` return 401 for a forged body (send one; check `billing_events` / `email_events` recorded it).
- [ ] Worker deployed; `/health` returns `engineReady: true`; a test search transitions queued → running → completed with real leads.
- [ ] A campaign test send arrives, the open arrives via webhook, and the unsubscribe link suppresses the address.
- [ ] Crons visible in the Vercel dashboard and succeeding (check the structured logs for `cron.campaigns` / `cron.recover` / `cron.cleanup`).
- [ ] Security headers present (`curl -I https://<your-domain>` → CSP, HSTS, `X-Frame-Options: DENY`).
