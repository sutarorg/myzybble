import "server-only";
import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { PlanRow, SubscriptionRow, SubscriptionStatus } from "@/types/database";
import { recomputeEntitlements } from "@/server/services/usage";
import { createNotification } from "@/server/services/notifications";

/**
 * Razorpay billing service (§11).
 *
 * Server-authoritative: the browser never decides plan, price or entitlement.
 * A subscription only becomes active when Razorpay tells us so through a
 * signature-verified webhook (or a server-side fetch of the subscription).
 *
 * IMPORTANT — account capability: Razorpay supports international payments and
 * USD, but *international payments must be activated on the Razorpay account*
 * and the account must be eligible for USD settlement. `docs/billing.md`
 * documents the verification steps; this code does not assume the capability is
 * present and surfaces a clear 503 rather than silently mis-charging.
 */

let razorpayClient: Razorpay | null = null;

export function razorpay(): Razorpay {
  if (razorpayClient) return razorpayClient;
  if (!serverEnv.RAZORPAY_KEY_ID || !serverEnv.RAZORPAY_KEY_SECRET) {
    throw Errors.dependency(
      "Razorpay is not configured on this deployment. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  razorpayClient = new Razorpay({
    key_id: serverEnv.RAZORPAY_KEY_ID,
    key_secret: serverEnv.RAZORPAY_KEY_SECRET,
  });
  return razorpayClient;
}

/** Maps Razorpay subscription statuses onto Zybble's own enum. */
export function mapSubscriptionStatus(status: string | undefined | null): SubscriptionStatus {
  switch ((status ?? "").toLowerCase()) {
    case "created":
    case "authenticated":
      return "incomplete";
    case "active":
      return "active";
    case "pending":
      return "trialing";
    case "halted":
      return "paused";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "completed":
    case "expired":
      return "expired";
    default:
      return "incomplete";
  }
}

export async function getPlanByCode(code: string): Promise<PlanRow> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("plans").select("*").eq("code", code).maybeSingle();
  if (error || !data) throw Errors.notFound("That plan doesn't exist.");
  return data as PlanRow;
}

export async function getPlanById(id: string): Promise<PlanRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("plans").select("*").eq("id", id).maybeSingle();
  return (data as PlanRow | null) ?? null;
}

export async function getSubscription(workspaceId: string): Promise<SubscriptionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

export interface CheckoutResult {
  subscriptionId: string;
  razorpaySubscriptionId: string;
  razorpayKeyId: string;
  planName: string;
  amountCents: number;
  currency: string;
}

/**
 * Creates (or reuses) the Razorpay customer + subscription for a workspace and
 * returns the identifiers the Checkout widget needs. Only the public key_id and
 * the subscription id reach the browser — never the key secret (§11).
 */
export async function createCheckoutSubscription(params: {
  workspaceId: string;
  planCode: string;
  billingEmail: string | null;
  userId: string;
}): Promise<CheckoutResult> {
  const { workspaceId, planCode } = params;
  const admin = createAdminClient();
  const client = razorpay();

  const plan = await getPlanByCode(planCode);
  if (plan.code === "free") {
    throw Errors.validation("The free plan doesn't require checkout.");
  }
  if (!plan.razorpay_plan_id) {
    throw Errors.dependency(
      "This plan has not been provisioned in Razorpay yet. Run the plan provisioning script (see docs/billing.md).",
    );
  }

  const existing = await getSubscription(workspaceId);

  // 1. Ensure a Razorpay customer exists for the workspace.
  let customerId = existing?.razorpay_customer_id ?? null;
  if (!customerId) {
    const customer = await client.customers.create({
      name: params.billingEmail ?? "zybble customer",
      email: params.billingEmail ?? undefined,
      notes: { workspace_id: workspaceId },
    } as never);
    customerId = (customer as { id: string }).id;
  }

  // 2. Create the subscription. Razorpay's recurring flow handles auth + charge.
  const subscription = await client.subscriptions.create({
    plan_id: plan.razorpay_plan_id,
    customer_id: customerId,
    total_count: 120, // rolling monthly billing; no fixed end by default
    quantity: 1,
    customer_notify: 1,
    notes: { workspace_id: workspaceId, plan_code: plan.code },
  } as never);

  const razorpaySubscriptionId = (subscription as { id: string }).id;

  // 3. Persist our own record; the webhook is what will activate it.
  const { error } = await admin.from("subscriptions").upsert(
    {
      workspace_id: workspaceId,
      plan_id: plan.id,
      status: mapSubscriptionStatus((subscription as { status?: string }).status),
      currency: plan.currency,
      razorpay_customer_id: customerId,
      razorpay_plan_id: plan.razorpay_plan_id,
      razorpay_subscription_id: razorpaySubscriptionId,
      metadata: { checkout_initiated_at: new Date().toISOString() },
      ...(existing?.id ? { id: existing.id } : {}),
    } as never,
    { onConflict: "razorpay_subscription_id" },
  );

  if (error) {
    logger.error("billing.checkout_persist_failed", {
      workspace_id: workspaceId,
      event: "billing.checkout",
      status: "error",
      error_code: error.code,
    });
    throw Errors.internal("Could not start checkout.");
  }

  return {
    subscriptionId: razorpaySubscriptionId,
    razorpaySubscriptionId,
    razorpayKeyId: serverEnv.RAZORPAY_KEY_ID!,
    planName: plan.name,
    amountCents: plan.price_cents,
    currency: plan.currency,
  };
}

/** Verifies the Checkout payment signature returned to the browser. */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!serverEnv.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", serverEnv.RAZORPAY_KEY_SECRET)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return safeEqual(expected, params.signature);
}

/**
 * Verifies a webhook signature over the **raw** request body.
 *
 * The body must not be parsed or re-serialised first: HMAC signs bytes, and
 * re-serialising changes key order/whitespace so the digest never matches.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!serverEnv.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", serverEnv.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return cryptoTimingSafeEqual(bufA, bufB);
}

/**
 * Records a provider event once and only once. The unique index on
 * (provider, provider_event_id) makes replayed webhooks a no-op (§11, §31).
 */
export async function beginBillingEvent(params: {
  eventId: string | undefined;
  eventType: string;
  payload: unknown;
  signatureValid: boolean;
}): Promise<{ isNew: boolean; id: string | null }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_events")
    .insert({
      provider: "razorpay",
      provider_event_id: params.eventId ?? null,
      event_type: params.eventType,
      payload: (params.payload ?? {}) as never,
      signature_valid: params.signatureValid,
      status: "received",
      attempts: 1,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    // 23505 = duplicate provider event id → replay, skip processing.
    if (error.code === "23505") return { isNew: false, id: null };
    logger.error("billing.event_persist_failed", {
      event: "billing.event",
      status: "error",
      error_code: error.code,
    });
    return { isNew: false, id: null };
  }
  return { isNew: true, id: (data as { id: string } | null)?.id ?? null };
}

export async function finishBillingEvent(
  id: string | null,
  status: "processed" | "failed" | "ignored",
  error?: string,
): Promise<void> {
  if (!id) return;
  const admin = createAdminClient();
  await admin
    .from("billing_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error: error ?? null,
    } as never)
    .eq("id", id);
}

/** Applies a subscription state change and recomputes entitlements. */
export async function applySubscriptionUpdate(params: {
  /**
   * Optional for webhook calls, which only know the provider's subscription id.
   * When omitted the workspace is resolved from the stored row — the webhook
   * must never take a workspace id from an unsigned payload field.
   */
  workspaceId?: string;
  razorpaySubscriptionId: string;
  status?: string;
  planId?: string;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: number | null;
  paymentId?: string | null;
  paymentStatus?: string | null;
  raw?: unknown;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("*")
    .eq("razorpay_subscription_id", params.razorpaySubscriptionId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.status) patch.status = mapSubscriptionStatus(params.status);
  if (params.planId) patch.plan_id = params.planId;
  if (params.currentPeriodStart) patch.current_period_start = new Date(params.currentPeriodStart * 1000).toISOString();
  if (params.currentPeriodEnd) patch.current_period_end = new Date(params.currentPeriodEnd * 1000).toISOString();
  if (params.cancelAtPeriodEnd !== undefined) patch.cancel_at_period_end = params.cancelAtPeriodEnd;
  if (params.cancelledAt) patch.cancelled_at = new Date(params.cancelledAt * 1000).toISOString();
  if (params.paymentId) patch.razorpay_payment_id = params.paymentId;
  if (params.paymentStatus) {
    patch.last_payment_at = new Date().toISOString();
    patch.last_payment_status = params.paymentStatus;
    patch.failed_payment_count = params.paymentStatus === "failed"
      ? Number((existing as SubscriptionRow | null)?.failed_payment_count ?? 0) + 1
      : 0;
  }
  if (params.raw) patch.metadata = params.raw as never;

  const resolvedWorkspaceId =
    params.workspaceId || (existing as SubscriptionRow | null)?.workspace_id || null;

  if (existing) {
    await admin
      .from("subscriptions")
      .update(patch as never)
      .eq("id", (existing as SubscriptionRow).id);
  } else if (params.razorpaySubscriptionId && resolvedWorkspaceId) {
    await admin.from("subscriptions").insert({
      workspace_id: resolvedWorkspaceId,
      razorpay_subscription_id: params.razorpaySubscriptionId,
      status: mapSubscriptionStatus(params.status),
      ...patch,
    } as never);
  }

  if (resolvedWorkspaceId) await recomputeEntitlements(resolvedWorkspaceId);

  if (params.paymentStatus === "failed" && resolvedWorkspaceId) {
    await createNotification({
      workspaceId: resolvedWorkspaceId,
      type: "payment_failed",
      title: "Payment failed",
      body: "We couldn't collect this month's subscription payment. Update your payment method to keep access.",
      href: "/billing",
      severity: "error",
      dedupeKey: `payment_failed:${params.razorpaySubscriptionId}:${params.paymentId ?? "na"}`,
    });
  }

  if (params.status && resolvedWorkspaceId) {
    await createNotification({
      workspaceId: resolvedWorkspaceId,
      type: "subscription_changed",
      title: "Subscription updated",
      body: `Your subscription is now ${mapSubscriptionStatus(params.status).replace("_", " ")}.`,
      href: "/billing",
      severity: "info",
      dedupeKey: `subscription:${params.razorpaySubscriptionId}:${params.status}`,
    });
  }
}

/** Cancels at period end (or immediately), and records the intent server-side. */
export async function cancelSubscription(params: {
  workspaceId: string;
  immediate?: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const subscription = await getSubscription(params.workspaceId);
  if (!subscription?.razorpay_subscription_id) {
    throw Errors.notFound("You don't have an active subscription.");
  }

  const client = razorpay();
  await client.subscriptions.cancel(subscription.razorpay_subscription_id, {
    cancel_at_cycle_end: params.immediate ? 0 : 1,
  } as never);

  await admin
    .from("subscriptions")
    .update({
      cancel_at_period_end: !params.immediate,
      cancelled_at: params.immediate ? new Date().toISOString() : null,
      status: params.immediate ? "cancelled" : subscription.status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", subscription.id);

  await recomputeEntitlements(params.workspaceId);
}

/** Switches plan: creates a new Razorpay subscription and retires the old one. */
export async function changePlan(params: {
  workspaceId: string;
  planCode: string;
  billingEmail: string | null;
  userId: string;
}): Promise<CheckoutResult> {
  const current = await getSubscription(params.workspaceId);
  if (current?.razorpay_subscription_id && current.status === "active") {
    // Cancel at cycle end so the customer isn't charged twice mid-period.
    try {
      const client = razorpay();
      await client.subscriptions.cancel(current.razorpay_subscription_id, {
        cancel_at_cycle_end: 1,
      } as never);
      const admin = createAdminClient();
      await admin
        .from("subscriptions")
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() } as never)
        .eq("id", current.id);
    } catch (error) {
      logger.warn("billing.plan_change_cancel_failed", {
        workspace_id: params.workspaceId,
        event: "billing.plan_change",
        status: "warn",
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return createCheckoutSubscription(params);
}

export async function listBillingEvents(workspaceId: string, limit = 50) {
  const supabase = await createClientForRead();
  const { data } = await supabase
    .from("billing_events")
    .select("id, event_type, status, signature_valid, created_at, processed_at, error, provider_event_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function createClientForRead() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}
