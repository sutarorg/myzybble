import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listAutomations, createAutomation } from "@/server/services/automations";
import { recordAudit } from "@/server/services/audit";
import { automationInputSchema } from "@/lib/validation";

export const GET = withRoute("GET /api/automations", async () => {
  const auth = await requireAuthContext();
  return json({ automations: await listAutomations(auth.workspaceId) });
});

export const POST = withRoute("POST /api/automations", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, automationInputSchema);

  const automation = await createAutomation(auth.workspaceId, auth.user.id, input);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "create",
    entityType: "automation",
    entityId: automation.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ automation }, 201);
});
