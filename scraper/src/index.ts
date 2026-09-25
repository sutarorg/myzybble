/**
 * Zybble Google Maps scraping worker — entrypoint.
 *
 * Runs as a long-lived Railway service. It polls a Postgres-backed queue,
 * atomically claims one job at a time, runs the pinned upstream engine, streams
 * results into Supabase, and keeps a lease alive so a crash is always
 * recoverable.
 *
 * Nothing here exposes an inbound scraping endpoint: the worker only ever
 * pulls from the database over its own service-role connection.
 */

import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config, shutdown, assertConfigured } from "./config";
import { health, startHealthServer, stopHealthServer } from "./health";
import { UPSTREAM } from "./adapter/upstream";
import { claimJob, requeueOrphans, workerHeartbeat } from "./persistence/supabase";
import { superviseJob } from "./supervisor";
import { logger } from "../../src/lib/logger";

const execFileAsync = promisify(execFile);

const logCtx = { worker_id: config.workerId, event: "worker.lifecycle" };

async function verifyEngine(): Promise<void> {
  if (config.devMode) {
    health.engineReady = true;
    logger.warn("worker.engine_skipped", {
      ...logCtx,
      status: "warn",
      note: "WORKER_DEV_MODE=true — the real engine is not invoked.",
    });
    return;
  }

  try {
    // `PLAYWRIGHT_BROWSERS_PATH` points at the image's pre-installed browsers.
    if (!existsSync(process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/ms-playwright")) {
      logger.warn("worker.browsers_missing", {
        ...logCtx,
        status: "warn",
        metadata: { path: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/ms-playwright" },
      });
    }
    await execFileAsync(config.scraperBin, ["-h"], { timeout: 20_000 });
    health.engineReady = true;
    logger.info("worker.engine_verified", {
      ...logCtx,
      status: "ok",
      metadata: { binary: config.scraperBin, version: UPSTREAM.version, commit: UPSTREAM.commit },
    });
  } catch (error) {
    health.engineReady = false;
    health.lastError = error instanceof Error ? error.message : String(error);
    logger.error("worker.engine_verification_failed", {
      ...logCtx,
      status: "error",
      error_code: "engine_unavailable",
      error_message: health.lastError,
    });
    throw error;
  }
}

async function main() {
  assertConfigured();
  await verifyEngine();
  startHealthServer();

  await workerHeartbeat("online");
  logger.info("worker.started", {
    ...logCtx,
    status: "ok",
    metadata: {
      version: config.version,
      region: config.region,
      engine: `${UPSTREAM.repo}@${UPSTREAM.version}`,
      dev_mode: config.devMode,
    },
  });

  let lastRecovery = 0;
  let lastRegistryHeartbeat = 0;

  while (!shutdown.draining) {
    health.lastPollAt = Date.now();

    try {
      // Recovery sweep: requeue anything whose lease expired (crashed worker).
      if (Date.now() - lastRecovery > config.recoveryIntervalMs) {
        lastRecovery = Date.now();
        const requeued = await requeueOrphans();
        if (requeued.length) {
          logger.warn("worker.requeued_orphans", {
            ...logCtx,
            event: "worker.requeued_orphans",
            status: "recovered",
            metadata: { count: requeued.length },
          });
        }
      }

      if (Date.now() - lastRegistryHeartbeat > config.heartbeatIntervalMs) {
        lastRegistryHeartbeat = Date.now();
        await workerHeartbeat(shutdown.draining ? "draining" : "online", {
          jobs_completed: health.jobsCompleted,
          jobs_failed: health.jobsFailed,
        });
      }

      const job = await claimJob(`${UPSTREAM.repo}@${UPSTREAM.version}`);
      if (!job) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      shutdown.activeJobId = job.id;
      health.lastJobAt = Date.now();

      const result = await superviseJob(job);
      if (result.status === "completed") health.jobsCompleted += 1;
      if (result.status === "failed") {
        health.jobsFailed += 1;
        health.lastError = result.error ?? null;
      }
    } catch (error) {
      health.lastError = error instanceof Error ? error.message : String(error);
      logger.error("worker.poll_error", {
        ...logCtx,
        status: "error",
        error_code: error instanceof Error ? error.name : "UnknownError",
        error_message: health.lastError,
      });
      await sleep(config.pollIntervalMs);
    } finally {
      shutdown.activeJobId = null;
    }
  }

  await gracefulShutdown();
}

let shutdownPromise: Promise<void> | null = null;

async function gracefulShutdown(): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    logger.info("worker.shutdown_started", { ...logCtx, status: "draining" });
    await workerHeartbeat("offline", {
      jobs_completed: health.jobsCompleted,
      jobs_failed: health.jobsFailed,
    });
    await stopHealthServer();
    logger.info("worker.shutdown_complete", { ...logCtx, status: "offline" });
  })();
  return shutdownPromise;
}

/**
 * SIGTERM/SIGINT handling for zero-downtime Railway deploys (§30).
 * The active job is given a grace period to checkpoint, then released back to
 * the queue so it resumes on another worker rather than being lost.
 */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (shutdown.draining) return;
    shutdown.draining = true;
    void gracefulShutdown();
    const forceExit = setTimeout(() => {
      logger.error("worker.forced_exit", { ...logCtx, status: "error", error_code: "drain_timeout" });
      process.exit(1);
    }, config.drainTimeoutMs);
    forceExit.unref();
  });
}

process.on("unhandledRejection", (reason) => {
  health.lastError = String(reason);
  logger.error("worker.unhandled_rejection", {
    ...logCtx,
    status: "error",
    error_code: "unhandled_rejection",
    error_message: String(reason),
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.error("worker.fatal", {
    ...logCtx,
    status: "error",
    error_code: "fatal",
    error_message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
