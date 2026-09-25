import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requestAccountDeletion, confirmAccountDeletion } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";
import { Errors } from "@/lib/errors";

const requestSchema = z.object({ password: z.string().min(1).max(200) });
const confirmSchema = z.object({ token: z.string().min(1).max(400) });

/**
 * Account deletion is two-step: request (authenticated, rate-limited, emails a
 * one-time link) then confirm (validates the token). Deleting is destructive,
 * so it also requires the current password.
 */
export const DELETE = withRoute("DELETE /api/settings/account", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const { password } = await readJson(request, requestSchema);

  await requestAccountDeletion({
    userId: auth.user.id,
    email: auth.user.email,
    fullName: auth.profile.full_name,
    password,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "delete",
    entityType: "account",
    entityId: auth.user.id,
    requestId: ctx.requestId,
    request,
    metadata: { verb: "deletion_requested" },
  });

  return json({ ok: true });
});

export const POST = withRoute("POST /api/settings/account", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const { token } = await readJson(request, confirmSchema);

  const ok = await confirmAccountDeletion({ userId: auth.user.id, token });
  if (!ok) throw Errors.validation("That deletion link is invalid or has expired.");

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "delete",
    entityType: "account",
    entityId: auth.user.id,
    requestId: ctx.requestId,
    request,
    metadata: { verb: "deletion_confirmed" },
  });

  return json({ ok: true });
});
