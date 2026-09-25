import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import {
  addLeadsToCampaign,
  removeLeadsFromCampaign,
  listCampaignLeads,
} from "@/server/services/campaigns";

const addSchema = z.object({ leadIds: z.array(z.string().uuid()).min(1).max(5_000) });

export const GET = withRoute("GET /api/campaigns/[id]/leads", async (_request, ctx) => {
  const auth = await requireAuthContext();
  return json({ leads: await listCampaignLeads(auth.workspaceId, ctx.params.id) });
});

export const POST = withRoute("POST /api/campaigns/[id]/leads", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const { leadIds } = await readJson(request, addSchema);
  const result = await addLeadsToCampaign({
    workspaceId: auth.workspaceId,
    campaignId: ctx.params.id,
    leadIds,
  });
  return json(result, 201);
});

export const DELETE = withRoute(
  "DELETE /api/campaigns/[id]/leads",
  async (request: NextRequest, ctx) => {
    const auth = await requireAuthContext();
    const { leadIds } = await readJson(request, addSchema);
    const removed = await removeLeadsFromCampaign({
      workspaceId: auth.workspaceId,
      campaignId: ctx.params.id,
      leadIds,
    });
    return json({ removed });
  },
);
