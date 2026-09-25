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

> **Just here for the env vars?** Section 8 is a click-by-click appendix —
> verified 25 Sept 2026 — showing exactly where in each provider's dashboard
> every value in `.env.example` comes from, with a master table at §8.7.

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
   # connection string: the "Connect" button in the project's top bar →
   # Session pooler (port 5432). Put it in .env.local as SUPABASE_DB_URL.
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
4. **Keys** (Settings → API Keys): copy the legacy anon key (public) and the
   legacy service-role key (server env only — it bypasses RLS). There is no
   separate "Settings → API" page any more — everything is under **Settings →
   API Keys**. Click-by-click in §8.2, including the new
   `sb_publishable_`/`sb_secret_` key system and the end-2026 legacy deprecation.

## 2. Vercel (web app + API + cron)

1. Import the repository; framework preset **Next.js** (build `next build`,
   output is auto-detected). Root directory: repo root.
   The preset is pinned in `vercel.json` (`"framework": "nextjs"`,
   `"buildCommand": "next build"`), which overrides both auto-detection and the
   dashboard setting. That pin is load-bearing: `vitest` pulls `vite` into the
   dependency tree, and when Vercel auto-detects the **Vite** preset instead it
   runs `vite build`, which fails instantly with
   `Could not resolve entry module "index.html"` — there is no Vite app in this
   repo. `tests/unit/vercel-config.test.ts` guards the pin.
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
   deploy: `/api/cron/campaigns` at 14:00 UTC, `/api/cron/recover` at 02:00 UTC,
   `/api/cron/cleanup` daily at 03:00 UTC. Vercel **Hobby** accounts are limited
   to *once-per-day* cron schedules, which is why all three jobs use daily
   expressions. Upgrade to Vercel **Pro** to enable sub-daily schedules
   (e.g. every 5/10 min) and set `CRON_MAX_DURATION_SECS=300` to unlock the
   5-minute function timeout for large campaign batches. When `CRON_SECRET` is
   set on the project, Vercel sends `Authorization: Bearer $CRON_SECRET` with
   every cron request, which is exactly what `requireCronSecret` checks.
4. **Domains**: add the domain, keep the suggested DNS records. HSTS, CSP and
   the rest of the header set ship from `next.config.ts` — nothing to configure.

## 3. Railway (scraping worker)

1. New service → **Deploy from repo**. In the service **Settings**:
   - **Root Directory** must be the **repo root** (empty or `/`). **Do NOT**
     set it to `/scraper` — `Dockerfile.worker` copies both `scraper/` and
     `src/` from the repo root, and the scraper imports shared modules from
     `src/lib/*` via relative paths. A wrong root directory produces the build
     error `"/scraper": not found`.
   - **Builder**: leave it at the default (**Railpack** / **Nixpacks** is fine)
     — Railway auto-detects `railway.toml` and switches to the Dockerfile
     builder. If builds fail, explicitly set Builder → **Dockerfile** and
     confirm Dockerfile path is `Dockerfile.worker`.
   Railway reads `railway.toml`, which selects `Dockerfile.worker`, sets the
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

---

## 8. Appendix: click-by-click — where every `.env` value comes from

> **Navigation verified against the provider dashboards' official docs on
> 25 September 2026.** Each subsection below names the exact menu labels as of
> that date and the variable(s) it fills. If a provider renames something, the
> "you're looking for" description still applies. Copy each value into
> `.env.local` (development) and the Vercel/Railway dashboards (deployments).

### 8.0 Values you generate yourself (no dashboard involved)

Open a terminal and run each of these; paste the output into the named
variable. Generate **separate values per environment** (never reuse the
staging secret in production):

```bash
openssl rand -hex 32   # → CRON_SECRET          (Vercel)
openssl rand -hex 32   # → WORKER_SHARED_SECRET (Railway + Vercel, same value)
openssl rand -hex 32   # → MAILBOX_ENCRYPTION_KEY (Vercel; ≥32 chars required)
```

Everything else in this category is a *choice*, not a lookup:

| Variable | You decide |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your canonical origin — `http://localhost:3000` locally, `https://<your-domain>` in production (from Vercel → Settings → Domains, §8.1) |
| `NEXT_PUBLIC_DEV_MODE` | `false` everywhere except local fixture work |
| `EMAIL_FROM` / `EMAIL_REPLY_TO` | An address **on your Resend-verified domain** (§8.4), e.g. `zybble <hello@yourdomain.com>` |
| `RESEND_VERIFIED_DOMAINS` | The same domain(s), comma-separated |
| `GEMINI_MODEL` | Leave the default `gemini-3.8-flash` unless you've decided otherwise |
| `WORKER_ID` | Leave unset on Railway (it uses `RAILWAY_REPLICA_ID` automatically) |
| `SCRAPER_*`, `WORKER_POLL_INTERVAL_MS`, `WORKER_HEARTBEAT_INTERVAL_MS`, `WORKER_LEASE_SECONDS`, `WORKER_RECOVERY_INTERVAL_MS`, `WORKER_MAX_JOB_RUNTIME_MS`, `WORKER_DRAIN_TIMEOUT_MS`, `WORKER_WORKDIR`, `PORT`, `SCRAPER_BIN`, `PLAYWRIGHT_BROWSERS_PATH`, `WORKER_DEV_MODE` | Tuning knobs with sane defaults — see `.env.example` and `docs/scraper.md`. Set `WORKER_DEV_MODE=false` (or unset) in production |

### 8.1 Vercel — where to paste the web app's values

1. Go to **vercel.com** → sign in → click your **zybble** project card.
2. **Project → Settings → Environment Variables**.
3. For each variable: paste the **Key**, paste the **Value**, tick the
   environments it applies to (**Production** / **Preview** / **Development**),
   click **Save**. Repeat for every variable marked "Vercel" in the master
   table (§8.7).
4. Your production URL: **Project → Settings → Domains** — the domain shown
   there (e.g. `zybble.vercel.app` or your custom domain) is the value for
   `NEXT_PUBLIC_SITE_URL` (with `https://`).
5. Variable changes don't apply to already-running deployments — after the
   last Save, go to **Project → Deployments → ⋯ on the latest → Redeploy**.

### 8.2 Supabase — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`

1. Go to **supabase.com/dashboard** → sign in → click your project's card.
2. **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`):
   - Click the **Connect** button in the project's **top bar**; the dialog
     shows `https://<project-ref>.supabase.co` as the host. Or find it at
     **Settings → API Keys** next to the "Project URL" heading.
3. **API keys** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`):
   - Left sidebar → **⚙ Project Settings** (gear icon, bottom) → **API Keys**.
     (There is no separate "Settings → API" page any more — this is the one
     place all keys live, legacy or not.)
   - **Important, as of 25 Sept 2026:** Supabase is deprecating the legacy
     `anon`/`service_role` JWT keys **by the end of 2026** in favour of
     `sb_publishable_…` / `sb_secret_…` keys. Both systems work side by side,
     and zybble's variable names match the **legacy** keys, so:
     1. On the **API Keys** page, open the legacy keys section (tab/heading
        "anon`/`service_role"). Copy the **`anon` `public`** value →
        `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
     2. Click **Reveal** on **`service_role` `secret`** → copy →
        `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses RLS: it goes only into
        server-side env (Vercel/Railway), never into anything `NEXT_PUBLIC_*`.
     3. On the same page, the **Publishable and secret API keys** tab is where
        you'd create the new-format keys. Recommended before the legacy keys
        go away: create them, swap the values into the same two variable names
        (they're drop-in replacements), and only then deactivate the legacy
        keys. Rotating a leaked legacy key is done in this same section.
4. **Database connection string** (`SUPABASE_DB_URL`, used only by
   `npm run db:migrate` from your machine):
   - Click **Connect** in the **top bar** of your project.
   - Choose the **Session pooler** tab (host
     `aws-0-<region>.pooler.supabase.com`, port **5432** — not the 6543
     transaction pooler; migrations use prepared statements).
   - Copy the URI, replace `[YOUR-PASSWORD]` with the database password you
     set at project creation (reset it via **Settings → Database → Database
     password → Reset** if lost) → that full URI is `SUPABASE_DB_URL`.

### 8.3 Razorpay — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

1. Go to **dashboard.razorpay.com** → sign in.
2. Pick the mode first: the **Test / Live mode** toggle sits at the top of the
   dashboard. Test keys start `rzp_test_`, live keys `rzp_live_` (live needs
   completed KYC). Set staging envs with test keys, production with live keys.
3. **API keys** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`):
   - Left sidebar → **Account & Settings** → **API Keys** (under "Website and
     app settings").
   - Click **Generate Test Key** (or **Generate Key** in live mode).
   - **Copy the Key Secret immediately** — Razorpay shows it once at
     generation and does not store it; also click to download the CSV as
     backup. Key ID → `RAZORPAY_KEY_ID`, secret → `RAZORPAY_KEY_SECRET`.
   - Only Owner/Admin roles can see this page.
4. **Webhook** (`RAZORPAY_WEBHOOK_SECRET` — *you invent this one*):
   - **Account & Settings → Webhooks** → **Add New Webhook**.
   - **URL**: `https://<your-domain>/api/webhooks/razorpay`.
   - **Secret**: type a fresh random string (run `openssl rand -hex 32` and
     paste the output here AND into `RAZORPAY_WEBHOOK_SECRET` — the two must
     match; this is the HMAC key zybble verifies `X-Razorpay-Signature`
     against).
   - **Events**: tick the payment events (`payment.captured`,
     `payment.failed`) and the `subscription.*` events.
   - Click **Create Webhook** and make sure it's **Active**.
5. **Plan IDs**: **Subscriptions → Plans** in the dashboard — create six plans
   matching the seeded tiers ($19/5k, $39/15k, $69/30k, $99/50k, $149/75k,
   $199/100k), then copy each dashboard **Plan ID** (`plan_…`) into the
   `plans` table's `razorpay_plan_id` column. `/api/billing/checkout` reads
   them from the database — the client never prices anything.

### 8.4 Resend — `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, domain settings

1. Go to **resend.com** → sign in → dashboard.
2. **Domain** (do this before `EMAIL_FROM` — the sandbox sender
   `onboarding@resend.dev` can only mail you):
   - Left nav → **Domains** → **Add Domain** → enter your domain → Resend
     shows the DNS records (DKIM/TXT/SPF).
   - Add those records at your DNS provider (registrar, Cloudflare, …) → back
     on the Resend **Domains** page wait for the status to turn **Verified**.
3. **API key** (`RESEND_API_KEY`):
   - Left nav → **API Keys** (or resend.com/api-keys) → **Create API Key**.
   - Give it a name (e.g. `zybble-production`), choose **Sending access**,
     optionally bind it to the verified domain → **Add**.
   - The key (`re_…`) is shown **once** in the "View API Key" modal — copy it
     straight into the env vars.
4. **Webhook** (`RESEND_WEBHOOK_SECRET`):
   - Left nav → **Webhooks** (or resend.com/webhooks) → **Add Webhook**.
   - **Endpoint URL**: `https://<your-domain>/api/webhooks/resend`.
   - Tick the email events: `email.sent`, `email.delivered`, `email.opened`,
     `email.clicked`, `email.bounced`, `email.complained`, `email.failed`,
     `email.delivery_delayed`, `email.suppressed`.
   - After **Add** you land on the webhook's page — copy the **Signing
     secret** (`whsec_…`) → `RESEND_WEBHOOK_SECRET`. (It stays visible on that
     webhook's page if you need it again; rotating it is on the same page, and
     zybble accepts multiple overlapping signatures during rotation.)

### 8.5 Google Gemini — `GEMINI_API_KEY`

1. Go to **aistudio.google.com** → sign in with a Google account (accept the
   Generative AI terms the first time).
2. Left sidebar → **Get API key** (or go straight to
   **aistudio.google.com/apikey**).
3. Click **Create API key** → choose **Create API key in a new project**
   (fastest) or pick an existing Google Cloud project.
4. Copy the key (`AIza…`) → `GEMINI_API_KEY`. Server-side only — it must never
   end up in a `NEXT_PUBLIC_*` variable.

### 8.6 Railway — worker variables and `WORKER_BASE_URL`

1. Go to **railway.com** → sign in → **New Project** → **Deploy from GitHub
   repo** → pick this repository. Railway reads `railway.toml`, builds
   `Dockerfile.worker`, and healthchecks `/health` before going live.
2. Click the **zybble-worker** service card → **Variables** tab.
3. Paste the worker variables (the "Railway" block in the master table, §8.7)
   via **Raw Editor** as `KEY=value` lines → **Update** → Railway redeploys.
   The `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` values are
   the **same ones** you copied in §8.2.
4. **Public URL** (`WORKER_BASE_URL` — set on the *Vercel* side, §8.1):
   - Service card → **Settings** tab → **Networking** → **Generate Domain**
     next to the health port.
   - Railway assigns something like
     `https://zybble-worker-production.up.railway.app` — that URL (with
     `https://`) is `WORKER_BASE_URL`.
   - `WORKER_SHARED_SECRET` must hold the **same value on both Railway and
     Vercel** — it authenticates the web app's worker-health checks.

### 8.7 Master table — every variable → where it comes from

| Variable | Where the value comes from | Set on |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your domain (Vercel → Settings → Domains, §8.1) | Vercel |
| `NEXT_PUBLIC_DEV_MODE` | You (§8.0) — `false` in production | Vercel |
| `CRON_SECRET` | You generate it (§8.0); Vercel's cron sends it automatically | Vercel |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → top-bar **Connect** or Settings → API Keys (§8.2) | Vercel **+** Railway |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys → legacy **anon** (§8.2) | Vercel **+** Railway* |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → legacy **service_role** (§8.2) | Vercel **+** Railway |
| `SUPABASE_DB_URL` | Supabase → **Connect** → Session pooler 5432 (§8.2) | Your machine only (migrations) |
| `RAZORPAY_KEY_ID` | Razorpay → Account & Settings → API Keys (§8.3) | Vercel |
| `RAZORPAY_KEY_SECRET` | Same dialog — shown once, download the CSV (§8.3) | Vercel |
| `RAZORPAY_WEBHOOK_SECRET` | You invent it in the Add-Webhook dialog; same string in both places (§8.3) | Vercel |
| `RESEND_API_KEY` | Resend → API Keys → Create (shown once) (§8.4) | Vercel |
| `EMAIL_FROM` | Your choice on the verified domain (§8.0/8.4) | Vercel |
| `EMAIL_REPLY_TO` | Your choice | Vercel |
| `RESEND_VERIFIED_DOMAINS` | Your verified domain(s) (§8.4) | Vercel |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → the webhook's Signing secret (`whsec_…`) (§8.4) | Vercel |
| `GEMINI_API_KEY` | AI Studio → Get API key → Create (§8.5) | Vercel |
| `GEMINI_MODEL` | Default `gemini-3.8-flash` (§8.0) | Vercel |
| `MAILBOX_ENCRYPTION_KEY` | You generate it (§8.0); rotating it means re-entering SMTP passwords (docs/operations.md §6) | Vercel |
| `WORKER_SHARED_SECRET` | You generate it; same value on both sides (§8.0/8.6) | Railway **+** Vercel |
| `WORKER_BASE_URL` | Railway → Settings → Networking → Generate Domain (§8.6) | Vercel |
| `WORKER_ID` | Leave unset (Railway injects `RAILWAY_REPLICA_ID`) | Railway |
| `SCRAPER_BIN`, `PLAYWRIGHT_BROWSERS_PATH` | Baked into the image — defaults in `.env.example` | Railway (usually unset) |
| `SCRAPER_CONCURRENCY`, `SCRAPER_PAGES_PER_BROWSER`, `SCRAPER_DEPTH`, `SCRAPER_INACTIVITY`, `SCRAPER_PROXIES` | Tuning defaults (docs/scraper.md) | Railway |
| `WORKER_POLL_INTERVAL_MS`, `WORKER_HEARTBEAT_INTERVAL_MS`, `WORKER_LEASE_SECONDS`, `WORKER_RECOVERY_INTERVAL_MS`, `WORKER_MAX_JOB_RUNTIME_MS`, `WORKER_DRAIN_TIMEOUT_MS`, `WORKER_WORKDIR`, `PORT` | Queue/lifecycle tuning defaults (`scraper/src/config.ts`) | Railway |
| `WORKER_DEV_MODE` | `false`/unset in production (§8.0) | Railway |

\* The worker talks to Supabase with the service-role key only; the anon key
is harmless to set but not required on Railway.
