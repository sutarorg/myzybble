import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { requireCronSecret } from "@/server/auth";

/**
 * Retention + hygiene tick.
 *
 * - Expires download tokens for finished CSV exports.
 * - Purges rate-limit buckets older than a day (the table would otherwise grow
 *   without bound).
 * - Fails scrape jobs that have been stuck in a non-terminal state far past
 *   their lease.
 *
 * Deleting leads by `data_retention_days` is intentionally *not* done here:
 * that's destructive, per-workspace, and belongs behind an explicit admin
 * action with an audit trail.
 */
export const maxDuration = 120;

export const GET = withRoute("GET /api/cron/cleanup", async (request: NextRequest) => {
  requireCronSecret(request);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [exportsRes, rateLimitRes, jobsRes] = await Promise.all([
    admin
      .from("exports")
      .update({ status: "expired" } as never)
      .lt("expires_at", now)
      .in("status", ["queued", "processing", "ready"])
      .select("id"),
    admin
      .from("rate_limit_buckets")
      .delete()
      .lt("window_start", new Date(Date.now() - 86_400_000).toISOString())
      .select("scope"),
    admin
      .from("scrape_jobs")
      .update({
        status: "failed",
        error_message: "The scraping worker stopped responding and the job was abandoned.",
        last_error_code: "lease_expired",
        completed_at: now,
        updated_at: now,
      } as never)
      .in("status", ["starting", "running", "paused"])
      .lt("lease_expires_at", new Date(Date.now() - 15 * 60_000).toISOString())
      .is("completed_at", null)
      .select("id") as unknown as { data: { id: string }[] | null },
  ]);

  const summary = {
    exportsExpired: exportsRes.data?.length ?? 0,
    rateLimitRowsPurged: rateLimitRes.data?.length ?? 0,
    jobsAbandoned: jobsRes.data?.length ?? 0,
  };

  logger.info("cron.cleanup", { event: "cron.cleanup", status: "ok", metadata: summary });
  return json(summary);
});

export const POST = GET;
