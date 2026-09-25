import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { createCheckoutSubscription } from "@/server/services/billing";
import { recordAudit } from "@/server/services/audit";
import { billingCheckoutSchema } from "@/lib/validation";

/**
 * Opens a Razorpay subscription checkout. Returns only the public key id and
 * the subscription id — the key secret stays server-side (§11).
 */
export const POST = withRoute("POST /api/billing/checkout", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("billing:action", `${auth.workspaceId}:${auth.user.id}`);

  const { planCode } = await readJson(request, billingCheckoutSchema);

  const result = await createCheckoutSubscription({
    workspaceId: auth.workspaceId,
    planCode,
    billingEmail: auth.user.email,
    userId: auth.user.id,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "billing",
    entityType: "subscription",
    entityId: result.subscriptionId,
    requestId: ctx.requestId,
    request,
    metadata: { verb: "checkout_started", planCode, amountCents: result.amountCents },
  });

  return json(result);
});
