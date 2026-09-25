/**
 * Razorpay webhook receiver (§11).
 *
 * Security properties, in order of enforcement:
 *  1. The **raw** request body is read as text — never parsed first — because
 *     HMAC-SHA256 signs bytes. Re-serialising JSON changes key order and
 *     whitespace, so the digest would never match.
 *  2. `X-Razorpay-Signature` is compared with a constant-time equality check
 *     against HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET).
 *  3. A failed signature is recorded (with the payload) for auditing and the
 *     request is rejected with 401. It is never applied.
 *  4. Every event is persisted with its provider event id behind a unique
 *     index, so a replayed delivery is a no-op rather than a double credit.
 *  5. The webhook — never the browser — is what activates a subscription.
 *
 * The route is excluded from CSRF origin checks in `withRoute` (providers can't
 * send an Origin header); the signature is the authentication here.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, clientIp } from "@/server/api";
import { requireRateLimit } from "@/server/rate-limit";
import {
  verifyWebhookSignature,
  beginBillingEvent,
  finishBillingEvent,
  applySubscriptionUpdate,
} from "@/server/services/billing";
import { recomputeEntitlements } from "@/server/services/usage";
import { sendPaymentSucceededEmail, sendPaymentFailedEmail, sendSubscriptionChangedEmail } from "@/server/services/email";
import { logger } from "@/lib/logger";
import { siteUrl } from "@/lib/env-public";

// Razorpay posts a few KB; 256 KB is generous and still bounded.
export const runtime = "nodejs";
export const maxDuration = 30;

const envelopeSchema = z.object({
  event: z.string().min(1).max(120),
  // `account_id` / `contains` / `payload` shapes vary by event; we only require
  // the event name and tolerate everything else.
  payload: z.unknown().optional(),
});

const paymentEntitySchema = z.object({
  id: z.string().optional(),
  order_id: z.string().optional(),
  subscription_id: z.string().optional(),
  status: z.string().optional(),
  amount: z.number().optional(),
});

const subscriptionEntitySchema = z.object({
  id: z.string().optional(),
  plan_id: z.string().optional(),
  status: z.string().optional(),
  current_start: z.number().nullable().optional(),
  current_end: z.number().nullable().optional(),
  charge_at: z.number().nullable().optional(),
  ended_at: z.number().nullable().optional(),
  notes: z.record(z.string(), z.unknown()).optional(),
});

function firstEntity(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const entity = p.payment ?? p.subscription ?? p.refund ?? p.dispute ?? p.invoice;
    if (entity && typeof entity === "object") {
      const e = entity as Record<string, unknown>;
      return (e.entity && typeof e.entity === "object"
        ? (e.entity as Record<string, unknown>)
        : e) as Record<string, unknown>;
    }
  }
  return {};
}

export const POST = withRoute("POST /api/webhooks/razorpay", async (request: NextRequest, ctx) => {
  await requireRateLimit("webhook", clientIp(request));

  // 1. Raw bytes — no JSON.parse before verification.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  // 2 + 3. Verify before doing anything else.
  const valid = verifyWebhookSignature(rawBody, signature);

  let parsed: z.infer<typeof envelopeSchema>;
  try {
    parsed = envelopeSchema.parse(JSON.parse(rawBody));
  } catch {
    logger.warn("webhook.malformed_body", { event: "billing.webhook", status: "error" });
    return json({ error: { code: "invalid_payload", message: "Malformed webhook body." } }, 400);
  }

  const eventId = request.headers.get("x-razorpay-event-id") ?? undefined;
  const { isNew, id } = await beginBillingEvent({
    eventId,
    eventType: parsed.event,
    payload: parsed.payload,
    signatureValid: valid,
  });

  if (!valid) {
    logger.warn("webhook.invalid_signature", {
      event: "billing.webhook",
      status: "error",
      metadata: { eventType: parsed.event, eventId },
    });
    await finishBillingEvent(id, "failed", "signature_invalid");
    return json({ error: { code: "invalid_signature", message: "Signature verification failed." } }, 401);
  }

  // 4. Replay guard: already processed, acknowledge and stop.
  if (!isNew) {
    logger.info("webhook.replay_skipped", {
      event: "billing.webhook",
      metadata: { eventType: parsed.event, eventId },
    });
    return json({ ok: true, duplicate: true });
  }

  try {
    await handle(parsed.event, firstEntity(parsed.payload));
    await finishBillingEvent(id, "processed");
    return json({ ok: true });
  } catch (error) {
    logger.error("webhook.handler_failed", {
      event: "billing.webhook",
      status: "error",
      error_message: error instanceof Error ? error.message : String(error),
      metadata: { eventType: parsed.event, eventId, requestId: ctx.requestId },
    });
    await finishBillingEvent(id, "failed", error instanceof Error ? error.message : String(error));
    // 500 tells Razorpay to retry; the idempotency guard makes that safe.
    return json({ error: { code: "handler_failed", message: "Handler failed." } }, 500);
  }
});

async function handle(event: string, entity: Record<string, unknown>): Promise<void> {
  switch (event) {
    case "payment.captured":
    case "payment.authorized": {
      const payment = paymentEntitySchema.parse(entity);
      if (!payment.subscription_id) return;
      await applySubscriptionUpdate({
        razorpaySubscriptionId: payment.subscription_id,
        paymentId: payment.id ?? null,
        paymentStatus: payment.status ?? "captured",
        raw: entity,
      });
      await notifyPayment(payment.subscription_id, payment.id ?? null);
      return;
    }

    case "payment.failed": {
      const payment = paymentEntitySchema.parse(entity);
      if (!payment.subscription_id) return;
      await applySubscriptionUpdate({
        razorpaySubscriptionId: payment.subscription_id,
        paymentId: payment.id ?? null,
        paymentStatus: "failed",
        raw: entity,
      });
      await notifyPaymentFailure(payment.subscription_id, payment.id ?? null);
      return;
    }

    case "subscription.activated":
    case "subscription.charged":
    case "subscription.authenticated": {
      const sub = subscriptionEntitySchema.parse(entity);
      if (!sub.id) return;
      await applySubscriptionUpdate({
        razorpaySubscriptionId: sub.id,
        status: mapStatus(sub.status),
        currentPeriodStart: sub.current_start ?? null,
        currentPeriodEnd: sub.current_end ?? null,
        raw: entity,
      });
      await notifySubscriptionChange(sub.id);
      return;
    }

    case "subscription.pending":
    case "subscription.halted": {
      const sub = subscriptionEntitySchema.parse(entity);
      if (!sub.id) return;
      await applySubscriptionUpdate({
        razorpaySubscriptionId: sub.id,
        status: mapStatus(sub.status),
        raw: entity,
      });
      await notifySubscriptionChange(sub.id);
      return;
    }

    case "subscription.cancelled":
    case "subscription.completed": {
      const sub = subscriptionEntitySchema.parse(entity);
      if (!sub.id) return;
      await applySubscriptionUpdate({
        razorpaySubscriptionId: sub.id,
        status: "cancelled",
        cancelledAt: sub.ended_at ?? Math.floor(Date.now() / 1000),
        cancelAtPeriodEnd: false,
        raw: entity,
      });
      await notifySubscriptionChange(sub.id);
      return;
    }

    case "subscription.paused": {
      const sub = subscriptionEntitySchema.parse(entity);
      if (!sub.id) return;
      await applySubscriptionUpdate({
        razorpaySubscriptionId: sub.id,
        status: "paused",
        raw: entity,
      });
      return;
    }

    case "subscription.resumed": {
      const sub = subscriptionEntitySchema.parse(entity);
      if (!sub.id) return;
      await applySubscriptionUpdate({
        razorpaySubscriptionId: sub.id,
        status: "active",
        raw: entity,
      });
      return;
    }

    default:
      logger.info("webhook.ignored_event", {
        event: "billing.webhook",
        metadata: { eventType: event },
      });
      return;
  }
}

function mapStatus(status: string | undefined): string {
  switch (status) {
    case "created":
      return "incomplete";
    case "authenticated":
    case "active":
      return "active";
    case "pending":
      return "past_due";
    case "halted":
      return "unpaid";
    case "cancelled":
    case "completed":
      return "cancelled";
    case "paused":
      return "paused";
    default:
      return status ?? "incomplete";
  }
}

/**
 * Resolves the workspace + owner email for a provider subscription id.
 *
 * Uses plain lookups rather than an embedded select because the typed database
 * client doesn't model the `subscriptions → plans` relationship, and the
 * webhook path doesn't need it in a single round trip.
 */
async function resolveSubscriptionOwner(
  subscriptionId: string,
): Promise<{ workspaceId: string; email: string; planName: string } | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, workspace_id, plan_id, updated_at")
    .eq("razorpay_subscription_id", subscriptionId)
    .maybeSingle();
  if (!subscription) return null;

  const row = subscription as { id: string; workspace_id: string; plan_id: string | null; updated_at: string };

  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", row.workspace_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", (member as { user_id: string }).user_id)
    .maybeSingle();
  const email = (profile as { email: string } | null)?.email;
  if (!email) return null;

  let planName = "zybble";
  if (row.plan_id) {
    const { data: plan } = await admin
      .from("plans")
      .select("name")
      .eq("id", row.plan_id)
      .maybeSingle();
    planName = (plan as { name: string } | null)?.name ?? planName;
  }

  return { workspaceId: row.workspace_id, email, planName };
}

/** Sends the matching receipt email, idempotently. */
async function notifyPayment(subscriptionId: string, paymentId: string | null): Promise<void> {
  const resolved = await resolveSubscriptionOwner(subscriptionId);
  if (!resolved) return;

  await sendPaymentSucceededEmail({
    email: resolved.email,
    planName: resolved.planName,
    amount: "your subscription",
    invoiceUrl: `${siteUrl}/billing`,
    paymentId: paymentId ?? subscriptionId,
  });

  await recomputeEntitlements(resolved.workspaceId);
}

async function notifyPaymentFailure(subscriptionId: string, invoiceId: string | null): Promise<void> {
  const resolved = await resolveSubscriptionOwner(subscriptionId);
  if (!resolved) return;

  await sendPaymentFailedEmail({
    email: resolved.email,
    planName: resolved.planName,
    invoiceId: invoiceId ?? subscriptionId,
  });
}

async function notifySubscriptionChange(subscriptionId: string): Promise<void> {
  const resolved = await resolveSubscriptionOwner(subscriptionId);
  if (!resolved) return;

  await sendSubscriptionChangedEmail({
    email: resolved.email,
    planName: resolved.planName,
    subscriptionId,
    // Bucketed to the minute so a burst of events for one change sends once.
    revision: Math.floor(Date.now() / 60_000),
  });

  await recomputeEntitlements(resolved.workspaceId);
}
