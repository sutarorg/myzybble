/**
 * Zybble adapter for the upstream `gosom/google-maps-scraper` engine.
 *
 * This module is the *only* place in the codebase that knows the upstream CLI
 * surface. Everything else talks to Zybble's own types, so upgrading the
 * upstream engine is a change confined to this file plus the parsers.
 *
 * Pinned: v1.18.1 (commit 549e4b5e61c7103685ef8392f246ebdba783ed03).
 * See scraper/PIN.md for the verification date and change procedure.
 */

export const UPSTREAM = {
  repo: "gosom/google-maps-scraper",
  version: "v1.18.1",
  commit: "549e4b5e61c7103685ef8392f246ebdba783ed03",
  image: "gosom/google-maps-scraper:v1.18.1",
  /** Google Maps caps a single query at ~120 results regardless of depth. */
  maxResultsPerQuery: 120,
} as const;

export interface ScrapeRequest {
  /** One line per query: "keyword in location". */
  queries: string[];
  /** Max results Zybble will persist. Enforced by the worker, not the CLI. */
  limit: number;
  language: string;
  radiusMeters?: number;
  /** Scroll depth. Kept low: extra depth mostly re-yields the same ~120 rows. */
  depth: number;
  concurrency: number;
  proxies?: string[];
  extractEmails: boolean;
  /** Inactivity timeout; the CLI exits when nothing new arrives. */
  inactivity: string;
  zoom?: number;
  geo?: string;
  pagesPerBrowser: number;
}

/** The raw record shape emitted by the upstream `-json` writer. */
export interface UpstreamPlace {
  input_id?: string;
  link?: string;
  title?: string;
  category?: string;
  address?: string;
  open_hours?: Record<string, string> | string;
  popular_times?: unknown;
  website?: string;
  phone?: string;
  plus_code?: string;
  review_count?: number;
  review_rating?: number;
  reviews_per_rating?: Record<string, number>;
  latitude?: number;
  longitude?: number;
  cid?: string;
  status?: string;
  descriptions?: string | string[];
  reviews_link?: string;
  thumbnail?: string;
  timezone?: string;
  price_range?: string;
  data_id?: string;
  street_view_url?: string;
  place_id?: string;
  images?: string[];
  reservations?: string;
  order_online?: string;
  menu?: string;
  owner?: string;
  complete_address?: string;
  credit_cards_accepted?: boolean | string;
  about?: Record<string, string[]>;
  user_reviews?: unknown[];
  user_reviews_extended?: unknown[];
  emails?: string[];
}

/**
 * Builds the argument vector for the upstream binary.
 *
 * Only flags documented in scraper/PIN.md are used. Anything Zybble filters on
 * (minimum rating, website/phone/email requirement, business status) is applied
 * in the worker, because the upstream CLI has no such flags — inventing one
 * would silently return unfiltered data.
 */
export function buildArgs(request: ScrapeRequest, inputPath: string, resultsPath: string): string[] {
  const args: string[] = [
    "-input", inputPath,
    "-results", resultsPath,
    "-json",
    "-lang", request.language,
    "-depth", String(request.depth),
    "-c", String(request.concurrency),
    "-pages-per-browser", String(request.pagesPerBrowser),
    "-exit-on-inactivity", request.inactivity,
  ];

  if (request.extractEmails) args.push("-email");
  if (typeof request.radiusMeters === "number" && request.radiusMeters > 0) {
    args.push("-radius", String(request.radiusMeters));
  }
  if (typeof request.zoom === "number") args.push("-zoom", String(request.zoom));
  if (request.geo) args.push("-geo", request.geo);
  if (request.proxies?.length) args.push("-proxies", request.proxies.join(","));

  return args;
}

/**
 * Expands Zybble search parameters into upstream query lines.
 *
 * Google Maps caps each query at ~120 results, so a request for more results is
 * fanned out over the keyword × location matrix. This is a real capability of
 * the engine (multiple input lines), not an invented one.
 */
export function buildQueries(
  keywords: string[],
  locations: string[],
  limit: number,
): string[] {
  const kw = keywords.length ? keywords : [""];
  const loc = locations.length ? locations : [""];

  const queries: string[] = [];
  for (const k of kw) {
    for (const l of loc) {
      const parts = [k.trim(), l.trim()].filter(Boolean);
      if (parts.length) queries.push(parts.join(" in "));
    }
  }

  // Only fan out as far as the requested limit actually requires.
  const needed = Math.max(1, Math.ceil(limit / UPSTREAM.maxResultsPerQuery));
  return queries.slice(0, Math.max(needed, queries.length));
}
