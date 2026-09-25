# zybble

**Turn Google Maps into verified leads.**

zybble scrapes Google Maps for businesses matching your keywords and cities, verifies their emails and phone numbers, dedupes them against everything you already have, and hands you a clean CSV — or drops them straight into an AI-written outreach campaign.

This repository is the whole product: a Next.js app on Vercel, a Postgres database with Supabase Auth/RLS/Realtime, and a Playwright-based scraping worker on Railway.

---

## Contents

- [What's in the box](#whats-in-the-box)
- [Stack](#stack)
- [Getting started](#getting-started)
- [Pricing & entitlements](#pricing--entitlements)
- [How a search actually works](#how-a-search-actually-works)
- [Project layout](#project-layout)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## What's in the box

| Area | What it does |
| --- | --- |
| **Find leads** | Multi-keyword × multi-location searches with radius, language, minimum rating/reviews and website/phone/email requirements |
| **Leads** | Search, filter, sort, paginate, bulk-select, tag, add to lists, mark contacted, per-lead detail with full source provenance |
| **Dedupe** | Strongest identity first — source id → canonical domain → normalised phone → name+address. Duplicates increment a counter; they never create a second lead and never cost you quota |
| **Lists** | Full CRUD, bulk add/remove, search within a list, export, live counts, no duplicate membership |
| **Search history** | Every search is persisted with its parameters, status, counters, duration and errors — and can be re-run in one click |
| **CSV export** | Real server-side streaming, RFC 4180 escaping, formula-injection guard, UTF-8 BOM, column selection |
| **AI Assistant** | Gemini with function calling over your own data. It can search, filter, summarise and draft — and asks before it spends quota or sends anything |
| **Campaigns** | Multi-step email sequences with delays, conditions, suppression, per-mailbox rate limits and idempotent sending |
| **Mailboxes** | Sending identities with AES-256-GCM encrypted SMTP credentials that are never returned to the browser |
| **Automations** | Trigger → Conditions → Actions, executed server-side with idempotency keys and a full run history |
| **Billing** | Six USD tiers, server-authoritative entitlements, Razorpay subscriptions with signature-verified idempotent webhooks |

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend + API | **Next.js 16 (App Router)** | Server Components for data-heavy pages, Route Handlers for the API, one deployable |
| Auth + DB + Realtime | **Supabase** | Postgres as the system of record, row level security as the last line of defence, Realtime Broadcast for live job counters |
| Scraping | **Railway** + `gosom/google-maps-scraper` | Playwright can't run in a Vercel request handler; the worker belongs on a long-lived container |
| AI | **Google Gemini** (`@google/genai`) | Function calling against your real workspace data |
| Payments | **Razorpay** | USD subscriptions; activation is server-side via signature-verified webhooks |
| Email | **Resend** | Transactional + campaign delivery with idempotency keys and webhook events |

No Redis. Postgres handles the queue (`FOR UPDATE SKIP LOCKED`), rate limiting and usage accounting.

## Getting started

```bash
git clone https://github.com/sutarorg/myzybble.git
cd myzybble
npm install
cp .env.example .env.local     # fill it in
```

You need a Supabase project (free tier is fine):

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the Project URL, `anon` key and `service_role` key into `.env.local`.
3. Copy the Postgres connection string into `SUPABASE_DB_URL`.
4. Apply the migrations:

```bash
npm run db:migrate
```

5. Enable email auth (Authentication → Providers → Email) and, for production, turn on **Confirm email**. Set the Site URL and redirect URLs to your origin plus `/auth/callback`.

6. Run it:

```bash
npm run dev
```

Open <http://localhost:3000>. The marketing site works immediately. The authenticated app needs the Supabase variables above.

### Running the scraper worker

Real scraping requires the pinned engine. See [`docs/scraper.md`](docs/scraper.md) — the short version:

```bash
docker build -f scraper/Dockerfile -t zybble-worker .
docker run --env-file .env.local -p 8080:8080 zybble-worker
curl localhost:8080/health
```

For local development without the engine, set `NEXT_PUBLIC_DEV_MODE=true` **and** `WORKER_DEV_MODE=true`. The worker then produces deterministic fixture leads, flagged with `is_dev_data = true` and badged in the UI. Nothing fake ever appears in production.

## Pricing & entitlements

Exactly six tiers, all USD, all monthly, all including email data, phone data, CSV export, the AI Assistant and Campaigns:

| Plan | Price | Leads / month |
| --- | --- | --- |
| Free | $0 | 100 |
| Starter | $19 | 5,000 |
| Growth | $39 | 15,000 |
| Pro | $69 | 30,000 |
| Scale | $99 | 50,000 |
| Business | $149 | 75,000 |
| Agency | $199 | 100,000 |

Prices and quotas live in the `plans` table. **The server is the only authority** on what a plan costs and includes — the client can request a plan but can never assert one.

**A billable lead is a unique lead successfully persisted.** Duplicates increment `scrape_jobs.duplicates` and cost nothing.

Quota is enforced in three places: before a job is created (`assertCapacity`), continuously inside the worker, and again at persistence time. A unique database index prevents running two jobs at once to get around the limit.

## How a search actually works

```
browser                Next.js (Vercel)              Postgres           worker (Railway)
   │                         │                           │                     │
   ├─ POST /api/searches ───▶│                           │                     │
   │                         ├─ assertCapacity() ───────▶│                     │
   │                         ├─ insert search + job ────▶│  (status: queued)   │
   │◀── { searchId, jobId } ─┤                           │                     │
   │                         │                           │◀── claim_scrape_job │
   │                         │                           │    (SKIP LOCKED)    │
   │                         │                           │                     │
   │                         │                           │◀── heartbeat (30s)  │
   │                         │                           │◀── counters (5s)    │
   │◀─ Realtime broadcast ───┼───────────────────────────│◀── increment ───────┤
   │   topic `job:<id>`      │                           │                     │
   │                         │                           │◀── upsert_lead ─────┤
   │                         │                           │    (dedupe + usage) │
   │                         │                           │◀── complete ────────┤
   │◀─ notification ─────────┤                           │                     │
```

The browser never scrapes. The counters you watch are real database values written by the worker; if you refresh, the page re-reads them from Postgres rather than reconstructing them from a socket.

## Project layout

```
src/
  app/
    (marketing)/     Public site — landing, pricing, blog, legal, /signin → /auth/login
    (auth)/          Login, signup, forgot/reset password, OAuth callback
    (app)/           Authenticated product: dashboard, leads, lists, campaigns…
    api/             Route Handlers (all validated, rate-limited, audit-logged)
  components/
    marketing/       Original landing-page components, preserved verbatim
    app/             Product UI primitives (Card, Button, Modal, Badge…)
  features/          Feature-level client components (leads, campaigns, billing…)
  lib/               Pure logic: env, csv, validation, normalisation, logger
  server/            Server-only: auth, API wrapper, rate limiting, services
  types/             Hand-maintained Supabase database types
scraper/
  src/adapter/       The only module that knows the upstream CLI
  src/parsers/       Incremental + complete JSONL parsing
  src/normalization/ Google Maps place → zybble lead
  src/persistence/   Claim, heartbeat, counters, upsert
supabase/migrations/ 0013 → 0015, applied in order
tests/               unit/ + integration/
```

Business logic stays out of presentational components. Services in `src/server/services/` are the typed boundary; everything above them renders.

## Environment variables

Every variable is documented in [`.env.example`](.env.example), grouped by provider with a note on where to set it.

**Server-only — must never reach the browser:**

`SUPABASE_SERVICE_ROLE_KEY` · `RAZORPAY_KEY_SECRET` · `RAZORPAY_WEBHOOK_SECRET` · `GEMINI_API_KEY` · `RESEND_API_KEY` · `RESEND_WEBHOOK_SECRET` · `SUPABASE_DB_URL` · `CRON_SECRET` · `WORKER_SHARED_SECRET` · `MAILBOX_ENCRYPTION_KEY` · SMTP passwords

`src/lib/env.ts` is marked `server-only`, so importing it from a Client Component is a build error rather than a runtime leak.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` across the app |
| `npm run worker:typecheck` | `tsc --noEmit` across the scraper |
| `npm run worker:dev` | Run the worker locally with `tsx` |
| `npm run db:migrate` | Apply `supabase/migrations/*.sql` in order |
| `npm test` | Vitest — unit + integration |
| `npm run test:watch` | Vitest in watch mode |

## Testing

```bash
npm test
```

**172 tests** across two suites:

- **Unit** (`tests/unit/`) — dedupe identity, domain/phone/email normalisation, RFC 4180 CSV including the formula-injection guard, subscription status mapping, webhook and payment signature verification, retry backoff, automation condition evaluation, personalisation, zod schemas, and the scraper adapter.
- **Integration** (`tests/integration/`) — RLS cross-tenant isolation, Supabase auth, the Razorpay webhook contract, and static checks over the migrations (RLS coverage on every user-owned table, idempotent DDL, secret handling).

The suites that need a live Supabase project **skip automatically** when their variables are absent, so `npm test` is safe in CI without secrets. See [`tests/integration/README.md`](tests/integration/README.md) to enable them.

## Deployment

Full runbooks live in [`docs/deployment.md`](docs/deployment.md). The short version:

1. **Supabase** — create the project, apply migrations, configure auth redirect URLs.
2. **Vercel** — import the repo, set the environment variables for each environment, deploy. Vercel Cron is configured by `vercel.json`.
3. **Railway** — deploy the worker from `scraper/Dockerfile`, set the worker variables, set `healthcheckPath` to `/health`.
4. **Razorpay** — verify the domain, enable international payments, create plans, point the webhook at `/api/webhooks/razorpay`.
5. **Resend** — verify your sending domain, create an API key, point delivery webhooks at `/api/webhooks/resend`.

## Documentation

| Doc | Covers |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | System design, data flow, why each piece is where it is |
| [`docs/research.md`](docs/research.md) | What we verified before building, and the decisions it drove |
| [`docs/database.md`](docs/database.md) | Schema, enums, functions, indexes, RLS policies |
| [`docs/scraper.md`](docs/scraper.md) | The pinned upstream engine, flags, output fields, upgrade procedure |
| [`docs/billing.md`](docs/billing.md) | Plans, entitlements, Razorpay setup, webhook handling |
| [`docs/ai.md`](docs/ai.md) | Gemini model, tools, grounding rules, confirmation flow |
| [`docs/email.md`](docs/email.md) | Resend setup, templates, idempotency, suppression |
| [`docs/security.md`](docs/security.md) | Threat model, secret handling, RLS, rate limits, audit logging |
| [`docs/operations.md`](docs/operations.md) | Running the worker, recovery, monitoring, runbooks |
| [`docs/integrations.md`](docs/integrations.md) | Per-provider setup and configuration reference |
| [`docs/deployment.md`](docs/deployment.md) | Vercel, Railway, Supabase, Razorpay, Resend deploy steps |

## Licence

Proprietary. See the repository terms.
