import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listCampaigns, createCampaign } from "@/server/services/campaigns";
import { recordAudit } from "@/server/services/audit";
import { campaignInputSchema } from "@/lib/validation";

export const GET = withRoute("GET /api/campaigns", async () => {
  const auth = await requireAuthContext();
  const campaigns = await listCampaigns(auth.workspaceId);
  return json({ campaigns });
});

export const POST = withRoute("POST /api/campaigns", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, campaignInputSchema);

  const campaign = await createCampaign({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    input,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "create",
    entityType: "campaign",
    entityId: campaign.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ campaign }, 201);
});
