import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { getSubscription } from "@/server/services/billing";
import { Errors } from "@/lib/errors";

/**
 * Returns the identifiers needed to open Razorpay's hosted customer portal for
 * the current subscription. Razorpay doesn't expose a signed portal session the
 * way Stripe does, so we return the subscription short URL (when present) and
 * let the UI link the customer to the invoice list on our own billing page.
 */
export const GET = withRoute("GET /api/billing/portal", async (request: NextRequest) => {
  const auth = await requireAuthContext();
  await requireRateLimit("billing:action", `${auth.workspaceId}:${auth.user.id}`);

  const subscription = await getSubscription(auth.workspaceId);
  if (!subscription) throw Errors.notFound("No subscription yet.");

  return json({
    subscriptionId: subscription.id,
    razorpaySubscriptionId: subscription.razorpay_subscription_id,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
});
