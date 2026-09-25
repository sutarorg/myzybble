import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { getSubscription, changePlan, cancelSubscription } from "@/server/services/billing";
import { recordAudit } from "@/server/services/audit";
import { billingCheckoutSchema } from "@/lib/validation";

export const GET = withRoute("GET /api/billing/subscription", async () => {
  const auth = await requireAuthContext();
  const subscription = await getSubscription(auth.workspaceId);
  return json({ subscription });
});

const cancelSchema = z.object({ immediate: z.boolean().default(false) });

/**
 * Plan change and cancellation. Both are server-side: the browser can request,
 * but Razorpay + the webhook decide what actually becomes true (§11).
 */
export const POST = withRoute("POST /api/billing/subscription", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("billing:action", `${auth.workspaceId}:${auth.user.id}`);

  const { planCode } = await readJson(request, billingCheckoutSchema);
  const result = await changePlan({
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
    metadata: { verb: "plan_change", planCode },
  });

  return json(result);
});

export const DELETE = withRoute(
  "DELETE /api/billing/subscription",
  async (request: NextRequest, ctx) => {
    const auth = await requireAuthContext();
    await requireRateLimit("billing:action", `${auth.workspaceId}:${auth.user.id}`);

    const body = await request.text();
    const { immediate } = cancelSchema.parse(body ? JSON.parse(body) : {});

    await cancelSubscription({ workspaceId: auth.workspaceId, immediate });

    await recordAudit({
      workspaceId: auth.workspaceId,
      actorUserId: auth.user.id,
      action: "billing",
      entityType: "subscription",
      requestId: ctx.requestId,
      request,
      metadata: { verb: "cancel", immediate },
    });

    return json({ ok: true });
  },
);
