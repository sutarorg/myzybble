import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import {
  getCampaign,
  getCampaignSteps,
  updateCampaign,
  deleteCampaign,
} from "@/server/services/campaigns";
import { recordAudit } from "@/server/services/audit";
import { campaignInputSchema } from "@/lib/validation";

const patchSchema = campaignInputSchema.partial();

export const GET = withRoute("GET /api/campaigns/[id]", async (_request, ctx) => {
  const auth = await requireAuthContext();
  const campaign = await getCampaign(auth.workspaceId, ctx.params.id);
  if (!campaign) return json({ error: { code: "not_found", message: "Campaign not found." } }, 404);
  const steps = await getCampaignSteps(auth.workspaceId, ctx.params.id);
  return json({ campaign, steps });
});

export const PATCH = withRoute("PATCH /api/campaigns/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, patchSchema);
  const campaign = await updateCampaign(auth.workspaceId, ctx.params.id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.mailboxId !== undefined ? { mailbox_id: input.mailboxId } : {}),
    ...(input.dailyLimit !== undefined ? { daily_limit: input.dailyLimit } : {}),
    ...(input.stopOnReply !== undefined ? { stop_on_reply: input.stopOnReply } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.scheduledAt !== undefined ? { scheduled_at: input.scheduledAt } : {}),
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "campaign",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ campaign });
});

export const DELETE = withRoute("DELETE /api/campaigns/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await deleteCampaign(auth.workspaceId, ctx.params.id);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "delete",
    entityType: "campaign",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ ok: true });
});
