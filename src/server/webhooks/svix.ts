import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Svix signature verification, implemented directly against the documented
 * construction so it can be unit tested without a network or an extra package.
 *
 * Resend delivers webhooks through Svix [1]. The scheme is:
 *
 *   headers   svix-id, svix-timestamp, svix-signature
 *   secret    "whsec_" + base64(key bytes)
 *   signed    `${id}.${timestamp}.${rawBody}`          (raw bytes, not JSON)
 *   digest    base64(HMAC-SHA256(key, signed))
 *   header    one or more space-separated `v1,<digest>` values; ANY match is
 *             valid, because a rotated secret produces two signatures during
 *             the overlap window.
 *
 * [1] https://resend.com/docs/webhooks/verify-webhooks-requests
 *
 * Two rules we follow strictly, both of which are easy to get wrong:
 *
 *  - **The raw body is signed.** Parsing to JSON and re-stringifying changes
 *    key order and whitespace, and the digest will never match.
 *  - **The timestamp is inside the signed content**, so verifying the digest
 *    also proves the timestamp wasn't tampered with. We still check it against
 *    a ±5 minute window (Svix's own default) to bound replay.
 */

export interface SvixHeaders {
  id: string | null | undefined;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
}

/** Svix's default replay window. */
export const SVIX_DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a Svix-signed webhook.
 *
 * Returns `false` — never throws — for every failure mode: missing secret,
 * missing headers, an unparseable timestamp, a stale timestamp, or a digest
 * mismatch. Callers treat `false` as "unauthenticated".
 */
export function verifySvixSignature(params: {
  payload: string;
  headers: SvixHeaders;
  secret: string | null | undefined;
  /** Injected for tests; defaults to now. */
  nowMs?: number;
  toleranceSeconds?: number;
}): boolean {
  const { payload, headers, secret, nowMs = Date.now(), toleranceSeconds = SVIX_DEFAULT_TOLERANCE_SECONDS } = params;

  if (!secret) return false;

  const id = headers.id;
  const timestamp = headers.timestamp;
  const signature = headers.signature;
  if (!id || !timestamp || !signature) return false;

  // Reject timestamps that aren't plain integers before doing arithmetic.
  if (!/^\d{1,15}$/.test(timestamp)) return false;

  const key = decodeSecret(secret);
  if (!key) return false;

  const tolerance = Number.isFinite(toleranceSeconds) && toleranceSeconds >= 0 ? toleranceSeconds : SVIX_DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > tolerance) return false;

  const expected = sign(key, id, timestamp, payload);

  // The header carries one or more space-separated signatures; any match wins.
  for (const part of signature.split(" ")) {
    const candidate = part.trim();
    if (!candidate.startsWith("v1,")) continue;
    if (constantTimeEquals(expected, candidate.slice(3))) return true;
  }

  return false;
}

/** Builds the base64 digest Svix puts in the header. */
export function signSvixPayload(params: {
  secret: string;
  id: string;
  timestamp: string | number;
  payload: string;
}): string {
  const key = decodeSecret(params.secret);
  if (!key) throw new Error("Svix secret must be a base64 payload prefixed with whsec_.");
  return sign(key, params.id, String(params.timestamp), params.payload);
}

function sign(key: Buffer, id: string, timestamp: string, payload: string): string {
  return createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`, "utf8").digest("base64");
}

/**
 * `whsec_<base64>` → key bytes. Returns null when the secret is unusable.
 *
 * A base64 decode never throws on garbage, so we sanity-check that we got real
 * key material out. We deliberately do *not* require exact base64 round-trip
 * equality: padding and whitespace conventions vary between tooling, and a
 * strict check would reject legitimate secrets.
 */
function decodeSecret(secret: string): Buffer | null {
  const raw = (secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret)
    .replace(/\s+/g, "");
  if (!raw) return null;

  // Reject anything that isn't base64-ish before we trust the decoded length.
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) return null;

  const key = Buffer.from(raw, "base64");
  if (key.length < 16) return null;
  return key;
}

/** Length-safe constant-time comparison (timingSafeEqual throws on length mismatch). */
function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
