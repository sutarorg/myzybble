import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listBillingEvents } from "@/server/services/billing";

/** Billing audit trail, newest first (§11). */
export const GET = withRoute("GET /api/billing/events", async () => {
  const auth = await requireAuthContext();
  return json({ events: await listBillingEvents(auth.workspaceId) });
});
