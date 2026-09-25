import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { sendDueCampaignSteps } from "@/server/services/campaigns";
import { logger } from "@/lib/logger";
import { requireCronSecret } from "@/server/auth";

/**
 * Campaign sender tick (§22).
 *
 * This — not the browser — is what sends email. It runs on a daily schedule
 * (Vercel Hobby plan restricts cron jobs to once per day), is idempotent per
 * (campaign, lead, step), respects each mailbox's daily cap and the
 * suppression list, and never trusts a client-supplied recipient.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
// Vercel Hobby caps Serverless Functions at 60s (300s on Pro). When you upgrade
// to Pro, raise this to 300 and CRON_MAX_DURATION_SECS is read at runtime for
// the internal batch-loop safety cap below.
export const maxDuration = 60;

export const GET = withRoute("GET /api/cron/campaigns", async (request: NextRequest) => {
  requireCronSecret(request);
  const started = Date.now();
  // Vercel Hobby plan restricts cron jobs to once per day, so process in
  // batches until no more due leads remain or we approach the function
  // timeout. Leave a 5s safety margin. CRON_MAX_DURATION_SECS env (seconds)
  // lets Pro deployments raise the loop cap when maxDuration is increased.
  const effectiveDuration = Number(process.env.CRON_MAX_DURATION_SECS ?? maxDuration);
  const maxRuntimeMs = (effectiveDuration - 5) * 1000;
  let totalSent = 0;
  let totalFailed = 0;
  for (let i = 0; i < 50; i++) {
    if (Date.now() - started > maxRuntimeMs) break;
    const batch = await sendDueCampaignSteps(200);
    totalSent += batch.sent;
    totalFailed += batch.failed;
    if (batch.sent === 0 && batch.failed === 0) break;
  }
  const result = { sent: totalSent, failed: totalFailed };

  logger.info("cron.campaigns", {
    event: "cron.campaigns",
    status: "ok",
    metadata: { ...result, durationMs: Date.now() - started },
  });

  return json({ ...result, durationMs: Date.now() - started });
});

export const POST = GET;
