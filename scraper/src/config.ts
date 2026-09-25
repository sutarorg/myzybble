/**
 * Worker configuration. Every secret comes from the environment (Railway
 * service variables); nothing is baked into the image.
 *
 * Values are normalised the same way the web app normalises its own
 * (`src/lib/env-normalize.ts`): quotes and stray whitespace from a dashboard
 * paste are stripped, a blank variable counts as unset, and a bare hostname in a
 * URL variable is read as `https://` — so the two deployments of this repository
 * accept exactly the same input for the two variables they share.
 */
import {
  diagnoseSupabaseServiceKey,
  diagnoseSupabaseUrl,
  normalizeEnvValue,
  toAbsoluteUrl,
} from "../../src/lib/env-normalize";

/** Read a service variable: trimmed, unquoted; `undefined` when blank. */
function envValue(name: string): string | undefined {
  return normalizeEnvValue(process.env[name]);
}

function required(name: string): string {
  const value = envValue(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example and docs/deployment.md.`,
    );
  }
  return value;
}

/** A numeric knob. A blank or non-numeric value falls back to the default. */
function numberValue(name: string, fallback: number): number {
  const value = envValue(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * `NEXT_PUBLIC_SUPABASE_URL` — the project URL, not an API key. A bare host is
 * accepted (that is what the Supabase dashboard shows you); anything else is
 * left untouched so `assertConfigured` can explain what is wrong with it.
 */
function supabaseUrl(): string {
  const value = envValue("NEXT_PUBLIC_SUPABASE_URL");
  if (!value) return "";
  return toAbsoluteUrl(value) ?? value;
}

export const config = {
  supabaseUrl: supabaseUrl(),
  supabaseServiceKey: envValue("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  workerId: envValue("WORKER_ID") ?? envValue("RAILWAY_REPLICA_ID") ?? `worker-${process.env.HOSTNAME ?? "local"}`,
  region: envValue("RAILWAY_REPLICA_REGION") ?? envValue("WORKER_REGION") ?? "unknown",
  version: envValue("WORKER_VERSION") ?? "1.0.0",

  /** How often to poll for a new job when idle. */
  pollIntervalMs: numberValue("WORKER_POLL_INTERVAL_MS", 3_000),
  /** How often to renew the job lease while running. */
  heartbeatIntervalMs: numberValue("WORKER_HEARTBEAT_INTERVAL_MS", 20_000),
  /** Lease duration. Recovery requeues a job once this expires. */
  leaseSeconds: numberValue("WORKER_LEASE_SECONDS", 120),
  /** How often to sweep orphaned jobs. */
  recoveryIntervalMs: numberValue("WORKER_RECOVERY_INTERVAL_MS", 60_000),

  /** Playwright browser concurrency handed to the upstream engine. */
  scrapeConcurrency: numberValue("SCRAPER_CONCURRENCY", 2),
  pagesPerBrowser: numberValue("SCRAPER_PAGES_PER_BROWSER", 2),
  scrapeDepth: numberValue("SCRAPER_DEPTH", 1),
  inactivityTimeout: envValue("SCRAPER_INACTIVITY") ?? "3m",
  proxies: (envValue("SCRAPER_PROXIES") ?? "").split(",").map((p) => p.trim()).filter(Boolean),

  /** Path to the upstream binary / container entrypoint wrapper. */
  scraperBin: envValue("SCRAPER_BIN") ?? "google-maps-scraper",
  /** Directory for transient input/result files. */
  workDir: envValue("WORKER_WORKDIR") ?? "/tmp/zybble-scraper",

  /** Health server port (Railway healthcheck). */
  port: numberValue("PORT", 8080),

  /**
   * Development-only: replaces the real engine with clearly-labelled fixture
   * data so local work never triggers real scraping (§45).
   */
  devMode: process.env.NODE_ENV !== "production" && envValue("WORKER_DEV_MODE") === "true",

  /**
   * Hard ceiling on wall-clock time for one job, so a wedged browser can never
   * hold a lease forever (§31).
   */
  maxJobRuntimeMs: numberValue("WORKER_MAX_JOB_RUNTIME_MS", 45 * 60 * 1000),

  /** Grace period after SIGTERM before the process force-exits. */
  drainTimeoutMs: numberValue("WORKER_DRAIN_TIMEOUT_MS", 30_000),
} as const;

/**
 * Validate the values the worker cannot run without. Called from `main()` before
 * anything reaches the network, so a dashboard mistake is one readable line in
 * the Railway logs — and the deploy is marked failed by the healthcheck rather
 * than looping on an unreachable queue.
 *
 * The two variables are the same ones the web app uses; the most common mistakes
 * are pasting an API key where the project URL belongs (which otherwise fails
 * deep inside the Supabase client as `Invalid URL`) and pasting the *anon* key
 * into the service-role slot (which otherwise yields RLS-filtered empty results).
 */
export function assertConfigured(): void {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");

  const urlProblem = diagnoseSupabaseUrl(url);
  const keyProblem = diagnoseSupabaseServiceKey(key);
  const problems = [
    ...(urlProblem ? [`NEXT_PUBLIC_SUPABASE_URL ${urlProblem}`] : []),
    ...(keyProblem ? [`SUPABASE_SERVICE_ROLE_KEY ${keyProblem}`] : []),
  ];

  if (problems.length > 0) {
    throw new Error(
      `Worker environment is unusable: ${problems.join("; ")}. ` +
        "Both values are on Supabase → Settings → API Keys (docs/deployment.md §8.2).",
    );
  }
}

export const shutdown = {
  draining: false,
  activeJobId: null as string | null,
};
