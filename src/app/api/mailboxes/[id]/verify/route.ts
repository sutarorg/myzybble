import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { verifyMailbox } from "@/server/services/campaigns";
import { recordAudit } from "@/server/services/audit";
import { requireRateLimit } from "@/server/rate-limit";

export const POST = withRoute("POST /api/mailboxes/[id]/verify", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("campaigns:action", `${auth.workspaceId}:verify`);

  const mailbox = await verifyMailbox(auth.workspaceId, ctx.params.id);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "mailbox",
    entityId: ctx.params.id,
    requestId: ctx.requestId,
    request,
    metadata: { verb: "mailbox_verify", status: mailbox.status },
  });

  return json({ mailbox });
});
