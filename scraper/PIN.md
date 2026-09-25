# Zybble scraping engine — pinned version

**Engine:** [`gosom/google-maps-scraper`](https://github.com/gosom/google-maps-scraper) (MIT)

| Field | Value | Verified |
|---|---|---|
| Release tag | `v1.18.1` | 2026-09-25 |
| Commit SHA | `549e4b5e61c7103685ef8392f246ebdba783ed03` | 2026-09-25 |
| Container image | `gosom/google-maps-scraper:v1.18.1` | 2026-09-25 |
| Browser engine | Playwright (default image variant) | 2026-09-25 |
| Build requirement (source builds) | Go 1.26.6+ | 2026-09-25 |

## Why pin

The upstream project is under active development and its CLI flags, output
fields and behaviour change between releases. Zybble therefore pins an exact
release and commit rather than tracking `latest`, so a deployed worker cannot
silently change behaviour on rebuild.

To change the pin:

1. Verify the new release's `--help` output and JSON/CSV field list against
   `scraper/src/parsers/` and `scraper/src/normalization/`.
2. Update `VERSION`, `COMMIT` and `IMAGE` in `scraper/src/adapter/upstream.ts`.
3. Update this file, including the verification date.
4. Run `npm test` — the parser fixtures assert the exact field contract.

## Verified CLI surface (v1.18.1)

```
-input string              Path to input file with queries (one per line)
-results string            Output file path (default: stdout)
-json                      Output JSON instead of CSV
-resume                    Resume a CLI file scrape by appending missing places
-depth int                 Max scroll depth in results (default: 10)
-c int                     Concurrency level (default: half of CPU cores)
-email                     Extract emails from business websites
-extra-reviews             Collect extended reviews (up to ~300)
-lang string               Language code, e.g. 'de' (default "en")
-geo string                Coordinates for search, e.g. '37.7749,-122.4194'
-zoom int                  Zoom level 0-21 (default: 15)
-radius float              Search radius in meters (default: 10000)
-grid-bbox string          Bounding box: "minLat,minLon,maxLat,maxLon"
-grid-cell float           Grid cell size in km (default: 1.0, used with -grid-bbox)
-proxies string            Comma-separated proxy list
-proxies-file string       Path to a file containing one proxy URL per line
-exit-on-inactivity dur    Exit after inactivity (e.g. '5m')
-fast-mode                 Quick mode with reduced data (max ~21 results/query)
-debug                     Show browser window
-browser-pool-size int     Number of browser processes (default: derived)
-pages-per-browser int     Max concurrent pages per browser process (default: 1)
-dsn string                PostgreSQL connection string (distributed mode)
-produce                   Produce seed jobs only (requires -dsn)
-leadsdb-api-key string    Export directly to LeadsDB
-writer string             Custom writer plugin ('dir:pluginName')
```

Zybble uses the **file-output mode** (`-input` + `-results -json`) rather than
`-dsn`, because Zybble owns its own queue, quota accounting and deduplication in
Supabase. Results are streamed from the output file as the scraper writes them.

## Verified JSON output fields (v1.18.1)

`input_id`, `link`, `title`, `category`, `address`, `open_hours`,
`popular_times`, `website`, `phone`, `plus_code`, `review_count`,
`review_rating`, `reviews_per_rating`, `latitude`, `longitude`, `cid`, `status`,
`descriptions`, `reviews_link`, `thumbnail`, `timezone`, `price_range`,
`data_id`, `street_view_url`, `place_id`, `images`, `reservations`,
`order_online`, `menu`, `owner`, `complete_address`, `credit_cards_accepted`,
`about`, `user_reviews`, `user_reviews_extended`, `emails`.

## Known limitations (documented, not invented)

- Google Maps returns at most ~120 results per query regardless of `-depth`.
  Zybble handles this by splitting large requests across multiple keyword ×
  location query lines, and by capping at the user's requested limit.
- `review_count` / `user_reviews` fields have shown upstream regressions in
  2026; Zybble treats review data as best-effort and never bills on it.
- Playwright driver downloads have failed historically; the Zybble worker image
  pre-installs browser dependencies at build time and verifies them at boot.
