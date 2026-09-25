import { describe, it, expect } from "vitest";
import { randomBytes, createHmac } from "node:crypto";
import {
  verifySvixSignature,
  signSvixPayload,
  SVIX_DEFAULT_TOLERANCE_SECONDS,
} from "../../src/server/webhooks/svix";
import { parseResendEvent } from "../../src/server/services/email-events";

/**
 * Resend delivers webhooks through Svix. The construction verified here is the
 * one Resend documents: base64(HMAC-SHA256(whsec_key, `${id}.${ts}.${body}`)),
 * compared against any `v1,<sig>` entry in the (space-separated) header.
 *
 * These tests are intentionally independent of the implementation: the
 * reference signature is computed from node:crypto right here, not by calling
 * the module under test.
 */

const SECRET = `whsec_${randomBytes(24).toString("base64")}`;
const keyBytes = Buffer.from(SECRET.slice("whsec_".length), "base64");

/** Returns the full header value, in the `v1,<digest>` form Svix sends. */
function signatureHeader(id: string, timestamp: string, payload: string): string {
  return `v1,${createHmac("sha256", keyBytes).update(`${id}.${timestamp}.${payload}`, "utf8").digest("base64")}`;
}

function headers(id: string, timestamp: string, payload: string) {
  return { id, timestamp, signature: signatureHeader(id, timestamp, payload) };
}

const NOW_S = 1_760_000_000;
const NOW_MS = NOW_S * 1000;
const PAYLOAD = JSON.stringify({ type: "email.delivered", data: { email_id: "abc", to: ["lead@example.com"] } });

describe("verifySvixSignature", () => {
  it("accepts a correctly signed request", () => {
    expect(
      verifySvixSignature({ payload: PAYLOAD, headers: headers("msg_1", String(NOW_S), PAYLOAD), secret: SECRET, nowMs: NOW_MS }),
    ).toBe(true);
  });

  it("is insensitive to whitespace inside the payload, because it signs bytes", () => {
    // Re-serialising JSON changes whitespace; the signature must follow the
    // exact body, which is why the route reads request.text() and never parses.
    const compact = JSON.stringify(JSON.parse(PAYLOAD));
    const padded = JSON.stringify(JSON.parse(PAYLOAD), null, 2);
    expect(compact).not.toBe(padded);
    expect(verifySvixSignature({ payload: padded, headers: headers("msg_1", String(NOW_S), padded), secret: SECRET, nowMs: NOW_MS })).toBe(true);
    expect(verifySvixSignature({ payload: compact, headers: headers("msg_1", String(NOW_S), padded), secret: SECRET, nowMs: NOW_MS })).toBe(false);
  });

  it("accepts any one of several signatures in the header (secret rotation)", () => {
    const other = `whsec_${randomBytes(24).toString("base64")}`;
    const stale = `v1,${createHmac("sha256", Buffer.from(other.slice(6), "base64"))
      .update(`msg_1.${NOW_S}.${PAYLOAD}`, "utf8")
      .digest("base64")}`;
    const fresh = signatureHeader("msg_1", String(NOW_S), PAYLOAD);
    expect(
      verifySvixSignature({
        payload: PAYLOAD,
        headers: { id: "msg_1", timestamp: String(NOW_S), signature: `${stale} ${fresh}` },
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = PAYLOAD.replace("lead@example.com", "attacker@example.com");
    expect(
      verifySvixSignature({ payload: tampered, headers: headers("msg_1", String(NOW_S), PAYLOAD), secret: SECRET, nowMs: NOW_MS }),
    ).toBe(false);
  });

  it("rejects a tampered id: the id is inside the signed content", () => {
    // Signed for msg_1, presented as msg_2.
    const h = headers("msg_1", String(NOW_S), PAYLOAD);
    expect(verifySvixSignature({ payload: PAYLOAD, headers: h, secret: SECRET, nowMs: NOW_MS })).toBe(true);
    expect(
      verifySvixSignature({ payload: PAYLOAD, headers: { ...h, id: "msg_2" }, secret: SECRET, nowMs: NOW_MS }),
    ).toBe(false);
  });

  it("rejects a tampered timestamp: it is inside the signed content", () => {
    const h = headers("msg_1", String(NOW_S), PAYLOAD);
    expect(verifySvixSignature({ payload: PAYLOAD, headers: h, secret: SECRET, nowMs: NOW_MS })).toBe(true);
    expect(
      verifySvixSignature({ payload: PAYLOAD, headers: { ...h, timestamp: String(NOW_S + 1) }, secret: SECRET, nowMs: NOW_MS }),
    ).toBe(false);
  });

  it("rejects a different secret", () => {
    expect(
      verifySvixSignature({ payload: PAYLOAD, headers: headers("msg_1", String(NOW_S), PAYLOAD), secret: `whsec_${randomBytes(24).toString("base64")}`, nowMs: NOW_MS }),
    ).toBe(false);
  });

  it.each([
    ["missing secret", { secret: null }],
    ["empty secret", { secret: "" }],
    ["missing id", { id: null }],
    ["missing timestamp", { timestamp: null }],
    ["missing signature", { signature: null }],
    ["empty signature", { signature: "" }],
  ])("fails closed on %s", (_label, override) => {
    const h = { id: "msg_1", timestamp: String(NOW_S), signature: signatureHeader("msg_1", String(NOW_S), PAYLOAD) };
    expect(
      verifySvixSignature({
        payload: PAYLOAD,
        headers: { ...h, ...override },
        secret: "secret" in override ? (override.secret as string | null) : SECRET,
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it("rejects a non-numeric timestamp instead of doing arithmetic on it", () => {
    const h = headers("msg_1", String(NOW_S), PAYLOAD);
    for (const bad of ["not-a-number", "1e9", "-5", "1.5", ""]) {
      expect(
        verifySvixSignature({ payload: PAYLOAD, headers: { ...h, timestamp: bad }, secret: SECRET, nowMs: NOW_MS }),
      ).toBe(false);
    }
  });

  it("rejects a stale timestamp outside the replay window", () => {
    const stale = String(NOW_S - SVIX_DEFAULT_TOLERANCE_SECONDS - 1);
    const h = { id: "msg_1", timestamp: stale, signature: signatureHeader("msg_1", stale, PAYLOAD) };
    expect(verifySvixSignature({ payload: PAYLOAD, headers: h, secret: SECRET, nowMs: NOW_MS })).toBe(false);
  });

  it("accepts a timestamp inside the window in either direction", () => {
    for (const offset of [-SVIX_DEFAULT_TOLERANCE_SECONDS + 1, 0, SVIX_DEFAULT_TOLERANCE_SECONDS - 1]) {
      const ts = String(NOW_S + offset);
      const h = { id: "msg_1", timestamp: ts, signature: signatureHeader("msg_1", ts, PAYLOAD) };
      expect(verifySvixSignature({ payload: PAYLOAD, headers: h, secret: SECRET, nowMs: NOW_MS })).toBe(true);
    }
  });

  it("ignores header entries that are not v1 signatures", () => {
    expect(
      verifySvixSignature({
        payload: PAYLOAD,
        headers: { id: "msg_1", timestamp: String(NOW_S), signature: "v2,nope plainjunk" },
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it("rejects a secret that carries no real key material", () => {
    for (const bad of ["whsec_", "whsec_!!!", "whsec_c2hvcnQ", ""]) {
      expect(
        verifySvixSignature({ payload: PAYLOAD, headers: headers("msg_1", String(NOW_S), PAYLOAD), secret: bad, nowMs: NOW_MS }),
      ).toBe(false);
    }
  });

  it("round-trips with signSvixPayload", () => {
    const sig = signSvixPayload({ secret: SECRET, id: "msg_9", timestamp: NOW_S, payload: PAYLOAD });
    expect(
      verifySvixSignature({
        payload: PAYLOAD,
        headers: { id: "msg_9", timestamp: String(NOW_S), signature: `v1,${sig}` },
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toBe(true);
  });
});

describe("parseResendEvent", () => {
  it("parses a delivered event with tags", () => {
    const parsed = parseResendEvent({
      type: "email.delivered",
      created_at: "2026-09-25T10:00:00.000Z",
      data: {
        email_id: "e1",
        message_id: "m1",
        from: "zybble <no-reply@updates.zybble.app>",
        to: ["Lead@example.com"],
        subject: "Hi",
        tags: { campaign_id: "c1", workspace_id: "w1" },
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe("email.delivered");
    expect(parsed!.data.tags?.campaign_id).toBe("c1");
    expect(parsed!.data.to?.[0]).toBe("Lead@example.com");
  });

  it("parses the bounce detail object", () => {
    const parsed = parseResendEvent({
      type: "email.bounced",
      data: { to: ["x@y.com"], bounce: { message: "Mailbox full", subType: "General", type: "Permanent" } },
    });
    expect(parsed?.data.bounce?.message).toBe("Mailbox full");
  });

  it("parses the failure reason object", () => {
    const parsed = parseResendEvent({
      type: "email.failed",
      data: { to: ["x@y.com"], failed: { reason: "Address not found" } },
    });
    expect(parsed?.data.failed?.reason).toBe("Address not found");
  });

  it("tolerates unknown extra fields", () => {
    const parsed = parseResendEvent({ type: "email.opened", data: { to: ["x@y.com"], something_new: 1 } });
    expect(parsed?.type).toBe("email.opened");
  });

  it.each([
    ["no type", { data: { to: ["x@y.com"] } }],
    ["no data", { type: "email.opened" }],
    ["null", null],
    ["string", "email.opened"],
    ["to is not an array", { type: "email.opened", data: { to: "x@y.com" } }],
    ["tags with non-string values", { type: "email.opened", data: { to: ["x@y.com"], tags: { a: 1 } } }],
  ])("rejects %s rather than guessing", (_label, body) => {
    expect(parseResendEvent(body)).toBeNull();
  });
});
