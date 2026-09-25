import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listLists, createList } from "@/server/services/lists";
import { recordAudit } from "@/server/services/audit";
import { listInputSchema } from "@/lib/validation";

export const GET = withRoute("GET /api/lists", async (_request, _ctx) => {
  const auth = await requireAuthContext();
  const lists = await listLists(auth.workspaceId);
  return json({ lists });
});

export const POST = withRoute("POST /api/lists", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, listInputSchema);

  const list = await createList(auth.workspaceId, auth.user.id, input);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "create",
    entityType: "list",
    entityId: list.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ list }, 201);
});
