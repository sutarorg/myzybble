import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { requeueOrphanedJobs } from "@/server/services/searches";
import { logger } from "@/lib/logger";
import { requireCronSecret } from "@/server/auth";

/**
 * Job recovery tick.
 *
 * Requeues jobs whose worker lease expired (a crashed or OOM-killed Railway
 * container) and fails jobs that have exhausted their attempts. The worker also
 * does this on boot; this is the belt-and-braces sweep that catches a worker
 * that died before it could requeue anything.
 */
export const maxDuration = 60;

export const GET = withRoute("GET /api/cron/recover", async (request: NextRequest) => {
  requireCronSecret(request);
  const repaired = await requeueOrphanedJobs();

  logger.info("cron.recover", {
    event: "cron.recover",
    status: "ok",
    metadata: { repaired: repaired.length },
  });

  return json({ repaired: repaired.length, jobIds: repaired });
});

export const POST = GET;
