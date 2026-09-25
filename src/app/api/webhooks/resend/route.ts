/**
 * Resend delivery-event receiver.
 *
 * Security properties, in order of enforcement:
 *  1. The **raw** request body is read as text — never parsed first. Resend
 *     delivers through Svix, whose signature covers the exact bytes; a
 *     JSON.parse/stringify round trip changes key order and whitespace and
 *     would never verify.
 *  2. The Svix signature is verified (see `src/server/webhooks/svix.ts`) with a
 *     constant-time comparison and a ±5 minute timestamp window, which bounds
 *     replay of an intercepted request.
 *  3. A failed signature is **recorded** — with the event type, for auditing —
 *     and rejected with 401. It is never applied.
 *  4. Every event is stored with its provider event id behind a unique index,
 *     so Resend's at-least-once delivery is a no-op on replay rather than a
 *     double-counted open.
 *  5. Bounces and complaints write a workspace-wide suppression entry, so the
 *     address is never contacted again — by this campaign or any other.
 *
 * The route is excluded from CSRF origin checks (a provider cannot send an
 * `Origin` header); the signature is the authentication here.
 */

import { NextRequest } from "next/server";
import { withRoute, json, clientIp } from "@/server/api";
import { requireRateLimit } from "@/server/rate-limit";
import { verifySvixSignature } from "@/server/webhooks/svix";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  parseResendEvent,
  beginEmailEvent,
  finishEmailEvent,
  applyEmailEvent,
} from "@/server/services/email-events";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = withRoute("POST /api/webhooks/resend", async (request: NextRequest, ctx) => {
  await requireRateLimit("webhook", clientIp(request));

  // 1. Raw bytes — no JSON.parse before verification.
  const rawBody = await request.text();

  // 2. Verify first.
  const valid = verifySvixSignature({
    payload: rawBody,
    headers: {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    secret: serverEnv.RESEND_WEBHOOK_SECRET,
  });

  // Resend's own delivery id doubles as our dedupe key.
  const providerEventId = request.headers.get("svix-id");

  let event: ReturnType<typeof parseResendEvent> = null;
  if (rawBody.length > 0) {
    try {
      event = parseResendEvent(JSON.parse(rawBody));
    } catch {
      // Let the explicit null-handling below deal with it.
    }
  }

  const eventType = event?.type ?? "unknown";
  const email = event?.data.to?.[0]?.toLowerCase() ?? null;

  if (!event) {
    logger.warn("webhook.malformed_body", { event: "email.webhook", status: "error" });
    return json({ error: { code: "invalid_payload", message: "Malformed webhook body." } }, 400);
  }

  // 3. Record the delivery — including invalid ones — before acting on it.
  const { id, isNew } = await beginEmailEvent({
    providerEventId,
    eventType,
    email,
    workspaceId: event.data.tags?.workspace_id ?? null,
    campaignId: event.data.tags?.campaign_id ?? null,
    campaignLeadId: null,
    payload: event,
    signatureValid: valid,
  });

  if (!valid) {
    logger.warn("webhook.invalid_signature", {
      event: "email.webhook",
      status: "error",
      metadata: { eventType, providerEventId },
    });
    await finishEmailEvent(id, "unverified", "signature_invalid");
    return json({ error: { code: "invalid_signature", message: "Signature verification failed." } }, 401);
  }

  // 4. Replay guard.
  if (!isNew) {
    logger.info("webhook.replay_skipped", {
      event: "email.webhook",
      metadata: { eventType, providerEventId },
    });
    return json({ ok: true, duplicate: true });
  }

  try {
    const { applied, reason } = await applyEmailEvent(event);
    await finishEmailEvent(id, applied ? "processed" : "ignored", applied ? null : (reason ?? null));
    return json({ ok: true, applied, reason: reason ?? null });
  } catch (error) {
    logger.error("webhook.handler_failed", {
      event: "email.webhook",
      status: "error",
      error_message: error instanceof Error ? error.message : String(error),
      metadata: { eventType, providerEventId, requestId: ctx.requestId },
    });
    await finishEmailEvent(id, "failed", error instanceof Error ? error.message : String(error));
    // 500 asks Resend to retry; the provider-event-id guard makes that safe.
    return json({ error: { code: "handler_failed", message: "Handler failed." } }, 500);
  }
});
