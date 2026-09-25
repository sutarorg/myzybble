import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getList, updateList, deleteList } from "@/server/services/lists";
import { recordAudit } from "@/server/services/audit";
import { listInputSchema } from "@/lib/validation";

const patchSchema = listInputSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const GET = withRoute("GET /api/lists/[id]", async (_request, ctx) => {
  const auth = await requireAuthContext();
  const list = await getList(auth.workspaceId, ctx.params.id);
  if (!list) return json({ error: { code: "not_found", message: "List not found." } }, 404);
  return json({ list });
});

export const PATCH = withRoute("PATCH /api/lists/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, patchSchema);
  const list = await updateList(auth.workspaceId, ctx.params.id, input);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "list",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ list });
});

export const DELETE = withRoute("DELETE /api/lists/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await deleteList(auth.workspaceId, ctx.params.id);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "delete",
    entityType: "list",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ ok: true });
});
