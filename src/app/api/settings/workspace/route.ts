import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getWorkspace, updateWorkspace, listMembers } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";
import { Errors } from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(120).optional(),
  billingEmail: z.string().trim().email("Enter a valid email").max(320).nullish(),
});

export const GET = withRoute("GET /api/settings/workspace", async () => {
  const auth = await requireAuthContext();
  const [workspace, members] = await Promise.all([
    getWorkspace(auth.workspaceId),
    listMembers(auth.workspaceId),
  ]);
  return json({ workspace, members });
});

/**
 * Only owners/admins can rename the workspace or change the billing email —
 * enforced here *and* by the RLS policy on `workspaces`.
 */
export const PATCH = withRoute("PATCH /api/settings/workspace", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  if (auth.role !== "owner" && auth.role !== "admin") {
    throw Errors.forbidden("Only an owner or admin can change workspace settings.");
  }

  const input = await readJson(request, patchSchema);
  const workspace = await updateWorkspace(auth.workspaceId, input);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "workspace",
    entityId: auth.workspaceId,
    requestId: ctx.requestId,
    request,
    changes: { fields: Object.keys(input) },
  });

  return json({ workspace });
});
