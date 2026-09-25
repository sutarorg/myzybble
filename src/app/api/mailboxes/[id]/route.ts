import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { updateMailbox, deleteMailbox } from "@/server/services/campaigns";
import { recordAudit } from "@/server/services/audit";
import { mailboxInputSchema } from "@/lib/validation";

/** Never accepts `email` or `provider`: a mailbox's identity is immutable. */
const patchSchema = mailboxInputSchema
  .partial()
  .omit({ email: true, provider: true });

export const PATCH = withRoute("PATCH /api/mailboxes/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, patchSchema);
  const mailbox = await updateMailbox(auth.workspaceId, ctx.params.id, input);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "mailbox",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
    changes: { fields: Object.keys(input) },
  });

  return json({ mailbox });
});

export const DELETE = withRoute("DELETE /api/mailboxes/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await deleteMailbox(auth.workspaceId, ctx.params.id);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "delete",
    entityType: "mailbox",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ ok: true });
});
