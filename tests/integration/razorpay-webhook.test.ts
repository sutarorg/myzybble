import { describe, it, expect, beforeAll, vi } from "vitest";
import { createHmac } from "node:crypto";

/**
 * Razorpay webhook contract tests.
 *
 * These run against a synthetic payload and a local secret — no network, no
 * database. They lock down the two properties that matter most:
 *   1. The signature is computed over the RAW body bytes.
 *   2. Anything else is rejected.
 */

const SECRET = "whsec_test_secret_value";

let verify: (rawBody: string, signature: string | null) => boolean;

beforeAll(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  // Imported lazily so the env var is set before `serverEnv` is parsed.
  return import("@/server/services/billing").then((m) => {
    verify = m.verifyWebhookSignature;
  });
});

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const sampleEvent = (event: string) =>
  JSON.stringify({
    event,
    payload: { payment: { entity: { id: "pay_1", subscription_id: "sub_1", status: "captured" } } },
  });

describe("webhook signature verification", () => {
  it("accepts a correctly signed delivery", () => {
    const body = sampleEvent("payment.captured");
    expect(verify(body, sign(body))).toBe(true);
  });

  it("accepts a body whose key order was preserved byte-for-byte", () => {
    // Re-serialising changes bytes, so the *original* string must be what's
    // signed. This test documents why the handler reads `request.text()`.
    const original = '{"event":"payment.captured","payload":{"a":1}}';
    const reserialised = JSON.stringify(JSON.parse(original));
    const signature = sign(original);
    expect(verify(original, signature)).toBe(true);
    expect(reserialised === original).toBe(true); // same bytes here…
    // …but a re-ordered object would not be:
    const reordered = '{"payload":{"a":1},"event":"payment.captured"}';
    expect(verify(reordered, signature)).toBe(false);
  });

  it("rejects a signature signed with a different secret", () => {
    const body = sampleEvent("payment.captured");
    expect(verify(body, sign(body, "wrong-secret"))).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verify(sampleEvent("payment.captured"), null)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verify(sampleEvent("payment.captured"), "")).toBe(false);
  });

  it("rejects a truncated signature", () => {
    const body = sampleEvent("payment.captured");
    expect(verify(body, sign(body).slice(0, 20))).toBe(false);
  });

  it("rejects a tampered body", () => {
    const body = sampleEvent("payment.captured");
    const signature = sign(body);
    const tampered = body.replace('"status":"captured"', '"status":"failed"');
    expect(verify(tampered, signature)).toBe(false);
  });

  /**
   * Failing closed is the security-critical behaviour: with no secret
   * configured, a webhook must be rejected rather than trusted.
   */
  it("fails closed when the secret is unset", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    vi.resetModules();
    const isolated = await import("@/server/services/billing");
    expect(isolated.verifyWebhookSignature("{}", "anything")).toBe(false);
    vi.unstubAllEnvs();
    vi.resetModules();
    // Re-import so later tests in this file use the configured secret again.
    const restored = await import("@/server/services/billing");
    verify = restored.verifyWebhookSignature;
  });
});

describe("webhook event mapping", () => {
  /**
   * The handler must map provider states through `mapSubscriptionStatus`, which
   * fails closed: an unrecognised state becomes `incomplete`, never `active`.
   */
  it("never promotes an unknown provider state to active", async () => {
    const { mapSubscriptionStatus } = await import("@/server/services/billing");
    for (const status of ["", "weird", "on_hold", "authenticated"]) {
      expect(mapSubscriptionStatus(status)).not.toBe("active");
    }
    expect(mapSubscriptionStatus("active")).toBe("active");
  });
});
