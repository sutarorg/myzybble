import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { sendDueCampaignSteps } from "@/server/services/campaigns";
import { logger } from "@/lib/logger";
import { requireCronSecret } from "@/server/auth";

/**
 * Campaign sender tick (§22).
 *
 * This — not the browser — is what sends email. It runs on a schedule, is
 * idempotent per (campaign, lead, step), respects each mailbox's daily cap and
 * the suppression list, and never trusts a client-supplied recipient.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export const maxDuration = 300;

export const GET = withRoute("GET /api/cron/campaigns", async (request: NextRequest) => {
  requireCronSecret(request);
  const started = Date.now();
  const result = await sendDueCampaignSteps(100);

  logger.info("cron.campaigns", {
    event: "cron.campaigns",
    status: "ok",
    metadata: { ...result, durationMs: Date.now() - started },
  });

  return json({ ...result, durationMs: Date.now() - started });
});

export const POST = GET;
