import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listCampaignActivity } from "@/server/services/campaigns";

export const GET = withRoute("GET /api/campaigns/[id]/activity", async (_request, ctx) => {
  const auth = await requireAuthContext();
  const activity = await listCampaignActivity(auth.workspaceId, ctx.params.id);
  return json({ activity });
});
