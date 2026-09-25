/**
 * Worker health endpoint (§5.16, §30).
 *
 * Exposes liveness/readiness for the Railway healthcheck without requiring any
 * inbound scraping capability: the worker pulls work, it never serves it.
 */

import { createServer, type Server } from "node:http";
import { config, shutdown } from "./config";
import { logger } from "../../src/lib/logger";

export interface HealthState {
  startedAt: number;
  lastPollAt: number | null;
  lastJobAt: number | null;
  jobsCompleted: number;
  jobsFailed: number;
  lastError: string | null;
  /** Set once the engine's browser dependencies have been verified. */
  engineReady: boolean;
}

export const health: HealthState = {
  startedAt: Date.now(),
  lastPollAt: null,
  lastJobAt: null,
  jobsCompleted: 0,
  jobsFailed: 0,
  lastError: null,
  engineReady: false,
};

let server: Server | null = null;

export function startHealthServer(): Server {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);

    if (url.pathname === "/health" || url.pathname === "/healthz") {
      const draining = shutdown.draining;
      const body = {
        status: draining ? "draining" : "ok",
        worker_id: config.workerId,
        region: config.region,
        version: config.version,
        uptime_ms: Date.now() - health.startedAt,
        dev_mode: config.devMode,
        engine_ready: health.engineReady,
        active_job_id: shutdown.activeJobId,
        last_poll_at: health.lastPollAt ? new Date(health.lastPollAt).toISOString() : null,
        last_job_at: health.lastJobAt ? new Date(health.lastJobAt).toISOString() : null,
        jobs_completed: health.jobsCompleted,
        jobs_failed: health.jobsFailed,
        last_error: health.lastError,
      };
      res.writeHead(draining ? 503 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }

    if (url.pathname === "/ready") {
      const ready = health.engineReady || config.devMode;
      res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ready }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  server.listen(config.port, "0.0.0.0", () => {
    logger.info("worker.health_listening", {
      worker_id: config.workerId,
      event: "worker.health_listening",
      status: "ok",
      metadata: { port: config.port },
    });
  });

  return server;
}

export function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    server = null;
  });
}
