import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getCampaignSteps, upsertSteps } from "@/server/services/campaigns";
import { campaignStepInputSchema } from "@/lib/validation";

const schema = z.object({ steps: z.array(campaignStepInputSchema).max(20) });

export const GET = withRoute("GET /api/campaigns/[id]/steps", async (_request, ctx) => {
  const auth = await requireAuthContext();
  return json({ steps: await getCampaignSteps(auth.workspaceId, ctx.params.id) });
});

export const PUT = withRoute("PUT /api/campaigns/[id]/steps", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const { steps } = await readJson(request, schema);
  const saved = await upsertSteps(auth.workspaceId, ctx.params.id, steps);
  return json({ steps: saved });
});
