/**
 * Worker configuration. Every secret comes from the environment (Railway
 * service variables); nothing is baked into the image.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example and docs/deployment.md.`,
    );
  }
  return value;
}

export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  workerId: process.env.WORKER_ID ?? process.env.RAILWAY_REPLICA_ID ?? `worker-${process.env.HOSTNAME ?? "local"}`,
  region: process.env.RAILWAY_REPLICA_REGION ?? process.env.WORKER_REGION ?? "unknown",
  version: process.env.WORKER_VERSION ?? "1.0.0",

  /** How often to poll for a new job when idle. */
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3_000),
  /** How often to renew the job lease while running. */
  heartbeatIntervalMs: Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 20_000),
  /** Lease duration. Recovery requeues a job once this expires. */
  leaseSeconds: Number(process.env.WORKER_LEASE_SECONDS ?? 120),
  /** How often to sweep orphaned jobs. */
  recoveryIntervalMs: Number(process.env.WORKER_RECOVERY_INTERVAL_MS ?? 60_000),

  /** Playwright browser concurrency handed to the upstream engine. */
  scrapeConcurrency: Number(process.env.SCRAPER_CONCURRENCY ?? 2),
  pagesPerBrowser: Number(process.env.SCRAPER_PAGES_PER_BROWSER ?? 2),
  scrapeDepth: Number(process.env.SCRAPER_DEPTH ?? 1),
  inactivityTimeout: process.env.SCRAPER_INACTIVITY ?? "3m",
  proxies: (process.env.SCRAPER_PROXIES ?? "").split(",").map((p) => p.trim()).filter(Boolean),

  /** Path to the upstream binary / container entrypoint wrapper. */
  scraperBin: process.env.SCRAPER_BIN ?? "google-maps-scraper",
  /** Directory for transient input/result files. */
  workDir: process.env.WORKER_WORKDIR ?? "/tmp/zybble-scraper",

  /** Health server port (Railway healthcheck). */
  port: Number(process.env.PORT ?? 8080),

  /**
   * Development-only: replaces the real engine with clearly-labelled fixture
   * data so local work never triggers real scraping (§45).
   */
  devMode: process.env.NODE_ENV !== "production" && process.env.WORKER_DEV_MODE === "true",

  /**
   * Hard ceiling on wall-clock time for one job, so a wedged browser can never
   * hold a lease forever (§31).
   */
  maxJobRuntimeMs: Number(process.env.WORKER_MAX_JOB_RUNTIME_MS ?? 45 * 60 * 1000),

  /** Grace period after SIGTERM before the process force-exits. */
  drainTimeoutMs: Number(process.env.WORKER_DRAIN_TIMEOUT_MS ?? 30_000),
} as const;

export function assertConfigured() {
  required("NEXT_PUBLIC_SUPABASE_URL");
  required("SUPABASE_SERVICE_ROLE_KEY");
}

export const shutdown = {
  draining: false,
  activeJobId: null as string | null,
};
