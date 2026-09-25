/**
 * Job supervisor: owns the full lifecycle of one claimed scrape job.
 *
 * Responsibilities (§5, §6, §31): claim → start → stream → normalise → dedupe →
 * persist → count → heartbeat → handle pause/cancel → complete/fail → recover.
 */

import { ScrapeRunner } from "./adapter/runner";
import { generateFixturePlaces } from "./adapter/fixtures";
import { UPSTREAM, type UpstreamPlace } from "./adapter/upstream";
import { normalizePlace, type NormalizedLead } from "./normalization/map-place";
import {
  bumpCounters,
  completeJob,
  heartbeat,
  logJobEvent,
  persistLead,
  readJobControl,
  setJobPaused,
  setJobRunning,
  type CounterDelta,
  type Job,
} from "./persistence/supabase";
import { config, shutdown } from "./config";
import { logger } from "../../src/lib/logger";
import { db } from "./persistence/supabase";

const COUNTER_FLUSH_MS = 1_000;
const QUOTA_CHECK_INTERVAL = 25;

interface Counters {
  actual: number;
  unique: number;
  duplicates: number;
  filtered: number;
  websites: number;
  phones: number;
  emails: number;
  verified: number;
  billable: number;
  errors: number;
}

export interface SupervisionResult {
  status: "completed" | "failed" | "cancelled" | "paused";
  counters: Counters;
  error?: string;
}

export async function superviseJob(job: Job): Promise<SupervisionResult> {
  const logCtx = {
    job_id: job.id,
    workspace_id: job.workspace_id,
    user_id: job.user_id,
    worker_id: config.workerId,
    event: "job.supervise",
  };

  const counters: Counters = {
    actual: 0, unique: 0, duplicates: 0, filtered: 0,
    websites: 0, phones: 0, emails: 0, verified: 0,
    billable: 0, errors: 0,
  };

  let stopRequested = false;
  let cancelRequested = false;
  let pauseRequested = false;
  let quotaExhausted = false;
  let lastFlush = Date.now();
  let processedSinceQuotaCheck = 0;

  const flush = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFlush < COUNTER_FLUSH_MS) return;
    lastFlush = now;
    await bumpCounters(job.id, diffCounters(counters, flushed));
    Object.assign(flushed, counters);
  };
  const flushed: Counters = { ...counters };

  const controlTimer = setInterval(() => {
    void readJobControl(job.id).then((control) => {
      if (!control) return;
      if (control.cancelRequested) cancelRequested = true;
      if (control.pauseRequested) pauseRequested = true;
      if (control.cancelRequested || control.pauseRequested) stopRequested = true;
    });
  }, 1_000);

  const heartbeatTimer = setInterval(() => {
    void heartbeat(job.id).then((ok) => {
      if (!ok) {
        // Lease lost (another worker took over, or the job was cancelled).
        stopRequested = true;
        logger.warn("job.lease_lost", { ...logCtx, event: "job.lease_lost", status: "warn" });
      }
    });
  }, config.heartbeatIntervalMs);

  try {
    await setJobRunning(job.id);
    await logJobEvent(job.id, job.workspace_id, "job.started", { status: "running" });

    const isDevData = config.devMode;

    const handleRecord = async (place: UpstreamPlace) => {
      if (quotaExhausted) return;

      counters.actual += 1;
      const lead = normalizePlace(place);
      if (!lead) {
        counters.filtered += 1;
        return;
      }

      // Filters the upstream engine cannot express (§7).
      if (!passesFilters(lead, job)) {
        counters.filtered += 1;
        return;
      }

      if (lead.website) counters.websites += 1;
      if (lead.phones.length) counters.phones += 1;
      if (lead.emails.length) counters.emails += 1;

      const result = await persistLead({
        workspaceId: job.workspace_id,
        userId: job.user_id,
        jobId: job.id,
        searchId: job.search_id,
        dedupeKey: lead.dedupeKey,
        payload: toPayload(lead),
        emails: lead.emails,
        phones: lead.phones,
        isDevData,
      });

      if (result.isNew) {
        counters.unique += 1;
        if (result.billable) counters.billable += 1;
      } else {
        counters.duplicates += 1;
      }

      processedSinceQuotaCheck += 1;
      if (processedSinceQuotaCheck >= QUOTA_CHECK_INTERVAL) {
        processedSinceQuotaCheck = 0;
        const remaining = await remainingQuota(job.workspace_id);
        if (remaining !== null && remaining <= 0) {
          quotaExhausted = true;
          stopRequested = true;
          logger.warn("job.quota_reached", { ...logCtx, event: "job.quota_reached", status: "warn" });
        }
      }

      if (Date.now() - lastFlush >= COUNTER_FLUSH_MS) await flush(true);
    };

    if (config.devMode) {
      logger.warn("job.dev_mode", {
        ...logCtx,
        event: "job.dev_mode",
        status: "warn",
        // Never let fixture output be mistaken for real scraping.
        note: "WORKER_DEV_MODE is on — fixtures are clearly labelled development data.",
      });

      const places = generateFixturePlaces(job.keywords, job.locations, job.requested_limit);
      for (const place of places) {
        if (stopRequested) break;
        await handleRecord(place);
        // Small delay so progress streaming is observable in development.
        await sleep(20);
      }
    } else {
      const runner = new ScrapeRunner(job.id, config.workDir);
      const outcome = await runner.run(
        {
          queries: job.keywords,
          limit: job.requested_limit,
          language: job.language ?? "en",
          radiusMeters: job.radius ?? undefined,
          depth: config.scrapeDepth,
          concurrency: config.scrapeConcurrency,
          proxies: config.proxies,
          extractEmails: true,
          inactivity: config.inactivityTimeout,
          pagesPerBrowser: config.pagesPerBrowser,
        },
        {
          onRecord: handleRecord,
          onLog: (line) => logger.debug("engine.output", { ...logCtx, event: "engine.output", message: line }),
          shouldStop: () => stopRequested || shutdown.draining,
        },
      );

      if (outcome.error && outcome.exitCode !== 0) {
        // A non-zero exit with partial results is still a recoverable run: we
        // keep whatever was persisted and report the failure honestly.
        counters.errors += 1;
        logger.error("job.engine_error", {
          ...logCtx,
          event: "job.engine_error",
          status: "error",
          error_code: "engine_exit",
          error_message: outcome.error,
        });
      }
    }

    await flush(true);

    if (cancelRequested) {
      await completeJob(job.id, "cancelled");
      return { status: "cancelled", counters };
    }

    if (pauseRequested) {
      await setJobPaused(job.id);
      await logJobEvent(job.id, job.workspace_id, "job.paused", { status: "paused", counters: counters as never });
      return { status: "paused", counters };
    }

    if (shutdown.draining) {
      // Graceful shutdown: leave the job queued so it resumes elsewhere.
      await db().from("scrape_jobs").update({
        status: "queued",
        worker_id: null,
        claimed_at: null,
        heartbeat_at: null,
        lease_expires_at: null,
      }).eq("id", job.id);
      await logJobEvent(job.id, job.workspace_id, "job.requeued_for_shutdown", { status: "queued" });
      return { status: "paused", counters };
    }

    if (quotaExhausted) {
      await completeJob(job.id, "completed", "Stopped at the plan's monthly lead limit.", "quota_reached");
      return { status: "completed", counters };
    }

    await completeJob(job.id, "completed");
    logger.info("job.completed", {
      ...logCtx,
      event: "job.completed",
      status: "ok",
      counters: counters as never,
    });
    return { status: "completed", counters };
  } catch (error) {
    counters.errors += 1;
    const message = error instanceof Error ? error.message : String(error);
    await flush(true);

    const retriable = job.attempts < job.max_attempts;
    if (retriable) {
      // Release back to the queue with an incremented attempt count.
      await db()
        .from("scrape_jobs")
        .update({
          status: "queued",
          worker_id: null,
          claimed_at: null,
          heartbeat_at: null,
          lease_expires_at: null,
          error_message: message,
        })
        .eq("id", job.id);
      await logJobEvent(job.id, job.workspace_id, "job.requeued", { status: "queued", message });
      logger.error("job.requeued", { ...logCtx, event: "job.requeued", status: "retry", error_message: message });
      return { status: "failed", counters, error: message };
    }

    await completeJob(job.id, "failed", message, "job_failed");
    logger.error("job.failed", {
      ...logCtx,
      event: "job.failed",
      status: "error",
      error_code: "job_failed",
      error_message: message,
    });
    return { status: "failed", counters, error: message };
  } finally {
    clearInterval(controlTimer);
    clearInterval(heartbeatTimer);
    shutdown.activeJobId = null;
  }
}

function passesFilters(lead: NormalizedLead, job: Job): boolean {
  if (job.require_website && !lead.website) return false;
  if (job.require_phone && lead.phones.length === 0) return false;
  if (job.require_email && lead.emails.length === 0) return false;
  if (job.min_rating !== null && (lead.rating === null || lead.rating < Number(job.min_rating))) return false;
  if (job.min_review_count !== null && (lead.reviewCount === null || lead.reviewCount < job.min_review_count)) {
    return false;
  }
  if (job.business_status && job.business_status !== "all") {
    const status = (lead.businessStatus ?? "").toLowerCase();
    if (job.business_status === "open" && /closed/.test(status)) return false;
    if (job.business_status === "closed" && !/closed/.test(status)) return false;
  }
  return true;
}

function toPayload(lead: NormalizedLead) {
  return {
    source: lead.source,
    source_id: lead.sourceId,
    business_name: lead.businessName,
    category: lead.category,
    categories: lead.categories,
    website: lead.website,
    maps_url: lead.mapsUrl,
    address: lead.address,
    street: lead.street,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    postal_code: lead.postalCode,
    latitude: lead.latitude,
    longitude: lead.longitude,
    rating: lead.rating,
    review_count: lead.reviewCount,
    business_status: lead.businessStatus,
    opening_hours: lead.openingHours,
    description: lead.description,
    social_links: lead.socialLinks,
    logo_url: lead.logoUrl,
    price_range: lead.priceRange,
    plus_code: lead.plusCode,
    source_metadata: { ...lead.sourceMetadata, dedupe_signal: lead.dedupeSignal },
    lead_score: lead.leadScore,
  };
}

function diffCounters(next: Counters, prev: Counters): CounterDelta {
  const delta: CounterDelta = {};
  const keys: (keyof Counters)[] = [
    "actual", "unique", "duplicates", "filtered",
    "websites", "phones", "emails", "verified", "billable", "errors",
  ];
  const fieldFor: Record<keyof Counters, keyof CounterDelta> = {
    actual: "actual_results",
    unique: "unique_results",
    duplicates: "duplicates",
    filtered: "filtered",
    websites: "websites_found",
    phones: "phones_found",
    emails: "emails_found",
    verified: "verified_emails",
    billable: "billable_leads",
    errors: "errors",
  };
  for (const key of keys) {
    const diff = next[key] - prev[key];
    if (diff !== 0) {
      (delta as Record<string, number>)[fieldFor[key]] = diff;
    }
  }
  return delta;
}

async function remainingQuota(workspaceId: string): Promise<number | null> {
  const { data } = await db()
    .from("entitlements")
    .select("leads_remaining")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) return null;
  return ((data as { leads_remaining?: number }).leads_remaining ?? null) as number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { UPSTREAM };
