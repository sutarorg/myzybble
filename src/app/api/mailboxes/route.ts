import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listMailboxes, createMailbox } from "@/server/services/campaigns";
import { recordAudit } from "@/server/services/audit";
import { mailboxInputSchema } from "@/lib/validation";

export const GET = withRoute("GET /api/mailboxes", async () => {
  const auth = await requireAuthContext();
  return json({ mailboxes: await listMailboxes(auth.workspaceId) });
});

export const POST = withRoute("POST /api/mailboxes", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const input = await readJson(request, mailboxInputSchema);

  const mailbox = await createMailbox({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    input,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "create",
    entityType: "mailbox",
    entityId: mailbox.id,
    requestId: ctx.requestId,
    request,
  });

  return json({ mailbox }, 201);
});
