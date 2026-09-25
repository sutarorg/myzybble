import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, readJson, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { controlJob } from "@/server/services/searches";
import { recordAudit } from "@/server/services/audit";

const schema = z.object({
  action: z.enum(["pause", "resume", "cancel", "retry"]),
});

/**
 * POST /api/searches/[id]/control — pause, resume, cancel or retry a job.
 *
 * The worker observes the resulting control flags on its next poll; it is never
 * sent commands directly, so no inbound worker endpoint is needed.
 */
export const POST = withRoute("POST /api/searches/[id]/control", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("campaigns:action", auth.user.id, ctx);

  const jobId = ctx.params.id;
  if (!jobId) throw new Error("Missing job id.");

  const { action } = await readJson(request, schema);
  const job = await controlJob({ workspaceId: auth.workspaceId, userId: auth.user.id, jobId, action });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "scrape_job",
    entityId: jobId,
    requestId: ctx.requestId,
    request,
    metadata: { action },
  });

  return json({ job });
});
