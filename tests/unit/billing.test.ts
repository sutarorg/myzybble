import { describe, it, expect, beforeAll, vi } from "vitest";

/**
 * `src/lib/env.ts` parses `process.env` once at import time, so secrets used by
 * the signature helpers must be set *before* the service module is loaded.
 * We therefore import it dynamically inside `beforeAll` rather than statically.
 */
let billing: typeof import("@/server/services/billing");
let campaigns: typeof import("@/server/services/campaigns");

beforeAll(async () => {
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "test-webhook-secret");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "key-secret");
  vi.resetModules();
  billing = await import("@/server/services/billing");
  campaigns = await import("@/server/services/campaigns");
});

/**
 * These tests cover the pure, decision-making parts of billing. Anything that
 * touches Razorpay's network or Postgres lives in the integration suite.
 */

describe("mapSubscriptionStatus", () => {
  it("maps Razorpay lifecycle states to our internal states", () => {
    expect(billing.mapSubscriptionStatus("created")).toBe("incomplete");
    expect(billing.mapSubscriptionStatus("authenticated")).toBe("incomplete");
    expect(billing.mapSubscriptionStatus("active")).toBe("active");
    expect(billing.mapSubscriptionStatus("pending")).toBe("trialing");
    expect(billing.mapSubscriptionStatus("halted")).toBe("paused");
    expect(billing.mapSubscriptionStatus("cancelled")).toBe("cancelled");
    expect(billing.mapSubscriptionStatus("canceled")).toBe("cancelled");
    expect(billing.mapSubscriptionStatus("completed")).toBe("expired");
    expect(billing.mapSubscriptionStatus("expired")).toBe("expired");
  });

  it("is case-insensitive", () => {
    expect(billing.mapSubscriptionStatus("ACTIVE")).toBe("active");
    expect(billing.mapSubscriptionStatus("Cancelled")).toBe("cancelled");
  });

  it("defaults to incomplete rather than granting access", () => {
    // Failing closed is the point: an unknown state must never become active.
    expect(billing.mapSubscriptionStatus("something-new")).toBe("incomplete");
    expect(billing.mapSubscriptionStatus(null)).toBe("incomplete");
    expect(billing.mapSubscriptionStatus(undefined)).toBe("incomplete");
    expect(billing.mapSubscriptionStatus("")).toBe("incomplete");
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correct HMAC-SHA256 hex signature", async () => {
    const { createHmac } = await import("node:crypto");
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const signature = createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    expect(billing.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects a signature for a different body", async () => {
    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "test-webhook-secret").update("other").digest("hex");
    expect(billing.verifyWebhookSignature("{\"event\":\"x\"}", signature)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(billing.verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("fails closed when the secret is not configured", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    vi.resetModules();
    const isolated = await import("@/server/services/billing");
    expect(isolated.verifyWebhookSignature("{}", "anything")).toBe(false);
    // Restore for the remaining tests in this file.
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "test-webhook-secret");
  });
});

describe("verifyPaymentSignature", () => {
  it("accepts a valid order|payment signature", async () => {
    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "key-secret").update("order_1|pay_1").digest("hex");
    expect(
      billing.verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature }),
    ).toBe(true);
  });

  it("rejects a signature over the wrong payload", async () => {
    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "key-secret").update("order_2|pay_1").digest("hex");
    expect(
      billing.verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature }),
    ).toBe(false);
  });

});

describe("campaign retry backoff", () => {
  it("grows exponentially", () => {
    expect(campaigns.backoff(0)).toBe(60_000);
    expect(campaigns.backoff(1)).toBe(120_000);
    expect(campaigns.backoff(2)).toBe(240_000);
  });

  it("caps at one hour", () => {
    expect(campaigns.backoff(10)).toBe(3_600_000);
    expect(campaigns.backoff(50)).toBe(3_600_000);
  });
});
