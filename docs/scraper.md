# Scraper

zybble does not implement Google Maps scraping. It wraps a well-maintained
upstream engine and adapts it.

## The pin

| | |
| --- | --- |
| Repository | `gosom/google-maps-scraper` |
| Version | **v1.18.1** |
| Commit | **`549e4b5e61c7103685ef8392f246ebdba783ed03`** |
| Image | `gosom/google-maps-scraper:v1.18.1` (Playwright variant) |
| Go | 1.26.6+ |
| Verified | 2025-09-25 |

Recorded in `scraper/PIN.md`, which also lists the flags and output fields we
actually verified, and is the single place to update when bumping.

**Why pin to a commit?** The engine moves quickly and its CLI surface changes
without ceremony. A tag is mutable; a commit is not. Pinning to a commit means
a rebuild six months from now produces the same behaviour.

## Flags we use

Only these, all verified against v1.18.1:

```
-input <path>              newline-separated queries
-results <path>            output file
-json                      JSONL output
-lang <code>               language
-depth <n>                 scroll depth
-c <n>                     concurrency
-pages-per-browser <n>     browser reuse
-exit-on-inactivity <dur>  e.g. 3m
-email                     extract emails from business websites
-radius <m>                radius around the search centre
-zoom <n>                  zoom level
-geo <lat,lng>             geographic centre
-proxies <csv>             proxy list
```

`-email` is what makes email data possible without a separate enrichment
vendor. It's slower, so it's passed only when the plan includes email data
(which all of them do).

## Flags we do NOT use

The upstream CLI has **no** flags for minimum rating, minimum review count,
website/phone/email requirement, or business status.

Those are zybble filters, applied in the worker *after* a place is parsed. This
matters: inventing a flag would either make the engine exit non-zero, or — worse
— be silently ignored and return unfiltered data while the UI claimed otherwise.

`tests/unit/scraper-adapter.test.ts` asserts that no such flag ever appears in
the argument vector.

## Output fields

The engine emits 36 fields per place. The ones we consume:

`place_id`, `cid`, `data_id`, `title`, `category`, `website`, `phone`,
`emails`, `review_rating`, `review_count`, `complete_address`, `address`,
`latitude`, `longitude`, `status`, `open_hours`, `about`, `thumbnail`,
`price_range`, `plus_code`, `link`, `descriptions`.

Everything we don't use is preserved verbatim in `leads.source_metadata`, so we
can start using a field later without re-scraping.

## The ~120 result cap

Google Maps returns at most ~120 results for a single query regardless of
`-depth`. Asking for 5,000 leads in Berlin with one query silently yields 120.

zybble fans out over the **keyword × location matrix** — a real capability of
the engine (it accepts multiple input lines), not a workaround we invented:

```
buildQueries(["dentist", "orthodontist"], ["Berlin", "Munich"], 5000)
→ ["dentist in Berlin", "dentist in Munich",
   "orthodontist in Berlin", "orthodontist in Munich"]
```

`buildQueries()` only fans out as far as the requested limit requires.

## Pipeline

```
claim job
   │
   ├─ buildQueries(keywords, locations, limit)      → input file
   ├─ spawn engine (buildArgs)                      → JSONL results
   ├─ parseIncremental (tailing, with rewind)       → UpstreamPlace
   ├─ normalizePlace                                → NormalizedLead
   ├─ apply Zybble filters (rating, requires, …)
   ├─ upsert_lead (dedupe + usage)                  → PostgreSQL
   ├─ flush counters every ~5s
   ├─ poll cancel_requested / pause_requested
   └─ complete_scrape_job
```

### Incremental parsing

`parseIncremental()` tails the results file and tracks a byte offset. A partial
line at the tail is rewound and retried on the next tick, so we never parse a
half-written record. Results are processed as they arrive, which is what makes
the counters move during a job rather than only at the end.

### Normalisation

`normalizePlace()` turns an `UpstreamPlace` into a `NormalizedLead`:

- **Identity** — `place_id` preferred, then `cid`, then `data_id`.
- **Dedupe key** — strongest signal available (see `docs/database.md`).
- **Emails** — collected from `emails` plus the `about` block, scored, then
  assessed. `valid` is only ever set by a real verification result.
- **Phones** — split on `, ; / |`, normalised to E.164 for matching; the raw
  string is kept for display.
- **Address** — parsed from `complete_address` into street/city/state/country/postal.
- **Social links** — extracted from the `about` block by canonical domain.
- **Lead score** — 0–100, transparent and data-driven: contactability,
  rating volume, rating, completeness.

### Filters

Applied in the worker, after normalisation:

| Filter | Behaviour |
| --- | --- |
| `minRating` | Drop below the threshold |
| `minReviewCount` | Drop below the threshold |
| `requireWebsite` | Drop when no website |
| `requirePhone` | Drop when no phone |
| `requireEmail` | Drop when no usable email |
| `businessStatus` | `open` / `closed` / `all` |

Filtered rows increment `scrape_jobs.filtered`. They are never persisted and
never billed.

## Worker lifecycle

| Concern | Mechanism |
| --- | --- |
| Claim | `claim_scrape_job()` — `FOR UPDATE SKIP LOCKED` + lease |
| Liveness | `heartbeat_scrape_job()` every 30s; returns false when cancelled |
| Crash recovery | Lease expiry → `/api/cron/recover` or the boot sweep |
| Graceful stop | SIGTERM → draining → finish batch → requeue |
| Cancel | `cancel_requested` polled between batches |
| Pause | `pause_requested` — the worker parks and re-claims later |
| Health | `GET /health`, `/healthz`, `/ready` on `$PORT` (default 8080) |

Boot also runs an engine self-test (`-h`) with `PLAYWRIGHT_BROWSERS_PATH` set,
so a broken browser install is caught at startup instead of mid-job.

## Running it

```bash
# locally, with tsx
npm run worker:dev

# as a container (what Railway runs)
docker build -f scraper/Dockerfile -t zybble-worker .
docker run --env-file .env.local -p 8080:8080 zybble-worker
curl localhost:8080/health
```

## Dev fixtures

With `WORKER_DEV_MODE=true` **and** `NEXT_PUBLIC_DEV_MODE=true`, the worker
produces deterministic fixture places instead of calling the engine. The
fixtures deliberately include duplicate identities so the dedupe path is
exercised, and every row is written with `is_dev_data = true` and badged in the
UI.

Fixture data never appears when either flag is off.

## Upgrading the engine

1. Read the upstream release notes and the current `README.md` — do not trust
   memory about the CLI.
2. Diff the flag surface and the output struct against `scraper/PIN.md`.
3. Update `UPSTREAM` in `scraper/src/adapter/upstream.ts` (version **and**
   commit) and the `Dockerfile` image tag.
4. Update `scraper/PIN.md` with the verification date and what changed.
5. Run `npm run worker:typecheck` and `npm test`; the adapter tests assert the
   pin and the flag surface.
6. Run one real job in staging before promoting.

## Operational notes

- **Playwright 404s** on browser download are the most common failure. Install
  browsers at image build time (`PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright`)
  rather than at runtime.
- **Upstream flakiness**: Google layout changes periodically break
  `review_count` and user-review extraction. Treat those fields as best-effort;
  a null is better than a wrong number.
- **Proxies**: for anything above a few thousand results per day per query,
  supply `-proxies`. Without them you will hit rate limits.
