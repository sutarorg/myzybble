import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { markNotificationRead } from "@/server/services/notifications";

export const PATCH = withRoute("PATCH /api/notifications/[id]", async (_request, ctx) => {
  const auth = await requireAuthContext();
  // Scoped by user id inside the service, so one member can't mark another's
  // notification read by guessing its uuid.
  const ok = await markNotificationRead(ctx.params.id, auth.user.id);
  if (!ok) return json({ error: { code: "not_found", message: "Notification not found." } }, 404);
  return json({ ok: true });
});
