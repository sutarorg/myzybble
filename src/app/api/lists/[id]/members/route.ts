import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { addLeadsToList, removeLeadsFromList } from "@/server/services/lists";
import { recordAudit } from "@/server/services/audit";

const schema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(10_000),
});

/** POST /api/lists/[id]/members — idempotent add (unique on list_id + lead_id). */
export const POST = withRoute("POST /api/lists/[id]/members", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const { leadIds } = await readJson(request, schema);
  const added = await addLeadsToList(auth.workspaceId, ctx.params.id, leadIds);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "list",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
    metadata: { added: added },
  });

  return json({ added });
});

export const DELETE = withRoute("DELETE /api/lists/[id]/members", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const { leadIds } = await readJson(request, schema);
  const removed = await removeLeadsFromList(auth.workspaceId, ctx.params.id, leadIds);
  return json({ removed });
});
