import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { verifyPaymentSignature } from "@/server/services/billing";
import { logger } from "@/lib/logger";

const schema = z.object({
  razorpayOrderId: z.string().min(1).max(120),
  razorpayPaymentId: z.string().min(1).max(120),
  razorpaySignature: z.string().min(1).max(400),
});

/**
 * Verifies the payment signature returned by the Checkout widget.
 *
 * This is deliberately *not* what activates a subscription — only the
 * signature-verified webhook does that (§11). This endpoint exists purely so
 * the UI can show "payment received, activating…" vs "payment failed" without
 * having to trust the browser's own report.
 */
export const POST = withRoute("POST /api/billing/verify", async (request: NextRequest) => {
  const auth = await requireAuthContext();
  await requireRateLimit("billing:action", `${auth.workspaceId}:${auth.user.id}`);

  const input = await readJson(request, schema);
  const valid = verifyPaymentSignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });

  logger.info("billing.payment_signature_checked", {
    workspace_id: auth.workspaceId,
    status: valid ? "ok" : "error",
  });

  return json({ valid });
});
