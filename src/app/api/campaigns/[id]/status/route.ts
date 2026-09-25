import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { setCampaignStatus } from "@/server/services/campaigns";
import { recordAudit } from "@/server/services/audit";
import { requireRateLimit } from "@/server/rate-limit";

const schema = z.object({
  status: z.enum(["draft", "scheduled", "running", "paused", "completed", "cancelled"]),
});

/**
 * Start / pause / resume / cancel. Sending itself is never triggered here —
 * a cron route drives `sendDueCampaignSteps`, so a browser can't force a blast.
 */
export const POST = withRoute("POST /api/campaigns/[id]/status", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("campaigns:action", `${auth.workspaceId}:${auth.user.id}`);

  const { status } = await readJson(request, schema);
  // "completed" is a terminal state the sender reaches on its own; a client can
  // only cancel, never claim completion.
  const campaign = await setCampaignStatus(
    auth.workspaceId,
    ctx.params.id,
    status === "completed" ? "cancelled" : status,
  );

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "campaign",
    metadata: { verb: `campaign_${status}` },
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ campaign });
});
