import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listNotifications, markAllRead } from "@/server/services/notifications";

export const GET = withRoute("GET /api/notifications", async () => {
  const auth = await requireAuthContext();
  return json({ notifications: await listNotifications(auth.workspaceId, auth.user.id) });
});

export const POST = withRoute("POST /api/notifications", async () => {
  const auth = await requireAuthContext();
  await markAllRead(auth.workspaceId, auth.user.id);
  return json({ ok: true });
});
