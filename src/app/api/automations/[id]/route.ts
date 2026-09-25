import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import {
  getAutomation,
  updateAutomation,
  deleteAutomation,
  listAutomationRuns,
} from "@/server/services/automations";
import { recordAudit } from "@/server/services/audit";
import { automationInputSchema } from "@/lib/validation";

const patchSchema = automationInputSchema.partial();

export const GET = withRoute("GET /api/automations/[id]", async (_request, ctx) => {
  const auth = await requireAuthContext();
  const automation = await getAutomation(auth.workspaceId, ctx.params.id);
  if (!automation) {
    return json({ error: { code: "not_found", message: "Automation not found." } }, 404);
  }
  const runs = await listAutomationRuns(auth.workspaceId, ctx.params.id);
  return json({ automation, runs });
});

export const PATCH = withRoute("PATCH /api/automations/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, patchSchema);
  const automation = await updateAutomation(auth.workspaceId, ctx.params.id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.trigger !== undefined ? { trigger: input.trigger as never } : {}),
    ...(input.conditions !== undefined ? { conditions: input.conditions as never } : {}),
    ...(input.actions !== undefined ? { actions: input.actions as never } : {}),
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "automation",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ automation });
});

export const DELETE = withRoute("DELETE /api/automations/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await deleteAutomation(auth.workspaceId, ctx.params.id);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "delete",
    entityType: "automation",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ ok: true });
});
