import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getProfile, updateProfile } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";
import { profileUpdateSchema } from "@/lib/validation";

export const GET = withRoute("GET /api/settings/profile", async () => {
  const auth = await requireAuthContext();
  return json({ profile: await getProfile(auth.user.id) });
});

export const PATCH = withRoute("PATCH /api/settings/profile", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, profileUpdateSchema);
  const profile = await updateProfile(auth.user.id, input);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "profile",
    entityId: auth.user.id,
    requestId: ctx.requestId,
    request,
    changes: { fields: Object.keys(input) },
  });

  return json({ profile });
});
