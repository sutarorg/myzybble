import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { Errors } from "@/lib/errors";

/**
 * Resend delivery-event processing.
 *
 * This is the other half of the campaign sender. `/api/cron/campaigns` sends
 * mail; this module records what happened to it afterwards, and — critically —
 * turns bounces and complaints into suppression entries so we never mail an
 * address that has already told us no.
 *
 * Design rules:
 *  - **Signature verification happens in the route, over the raw body**, before
 *    anything here runs. See `src/server/webhooks/svix.ts`.
 *  - **Every delivery is recorded in `email_events`** with its provider event
 *    id behind a unique index, so a replayed webhook is a no-op rather than a
 *    double-counted open.
 *  - **An invalid signature is recorded, not applied.** We store the event with
 *    `signature_valid = false` for auditing and reject with 401.
 *  - **Unknown event types are recorded and ignored**, never guessed at.
 */

const EMAIL_EVENT = "email";

/** The subset of Resend's payload we depend on; extra fields are tolerated. */
const baseEmailEventSchema = z.object({
  created_at: z.string().optional(),
  email_id: z.string().optional(),
  message_id: z.string().optional(),
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  subject: z.string().optional(),
  broadcast_id: z.string().optional(),
  template_id: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const emailEventSchema = z.object({
  type: z.string().min(1).max(80),
  created_at: z.string().optional(),
  data: baseEmailEventSchema.extend({
    bounce: z.object({ message: z.string().optional(), subType: z.string().optional(), type: z.string().optional() }).optional(),
    failed: z.object({ reason: z.string().optional() }).optional(),
    suppressed: z.object({ message: z.string().optional(), type: z.string().optional() }).optional(),
    click: z.object({ ipAddress: z.string().optional(), link: z.string().optional(), timestamp: z.string().optional(), userAgent: z.string().optional() }).optional(),
  }),
});

export type ResendEmailEvent = z.infer<typeof emailEventSchema>;

/** Event types that change a recipient's state. Everything else is recorded only. */
const STATEFUL = new Set([
  "email.scheduled",
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);

export interface RecordEmailEventInput {
  providerEventId: string | null;
  eventType: string;
  email: string | null;
  workspaceId: string | null;
  campaignId: string | null;
  campaignLeadId: string | null;
  payload: unknown;
  signatureValid: boolean;
  error?: string | null;
}

export interface RecordEmailEventResult {
  id: string;
  /** False when this provider event id was already stored — i.e. a replay. */
  isNew: boolean;
}

/**
 * Persists the raw event. Returns `isNew: false` for a duplicate provider
 * event id, which is what makes at-least-once delivery safe.
 */
export async function beginEmailEvent(input: RecordEmailEventInput): Promise<RecordEmailEventResult> {
  const admin = createAdminClient();

  // Without a provider event id there is nothing to dedupe on, so we always
  // insert and let the caller decide. Resend always sends one.
  const providerEventId = input.providerEventId ?? null;

  if (providerEventId) {
    const { data: existing } = await admin
      .from("email_events")
      .select("id")
      .eq("provider", "resend")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();

    const row = existing as { id: string } | null;
    if (row) return { id: row.id, isNew: false };
  }

  const { data, error } = await admin
    .from("email_events")
    .insert({
      provider: "resend",
      provider_event_id: providerEventId,
      event_type: input.eventType,
      email: input.email as never,
      workspace_id: input.workspaceId,
      campaign_id: input.campaignId,
      campaign_lead_id: input.campaignLeadId,
      payload: (input.payload ?? {}) as never,
      signature_valid: input.signatureValid,
      error: input.error ?? null,
      processed_at: null,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    // A concurrent duplicate trips the unique index; treat it as a replay.
    if (providerEventId && /duplicate key|23505/i.test(error?.message ?? "")) {
      const { data: raced } = await admin
        .from("email_events")
        .select("id")
        .eq("provider", "resend")
        .eq("provider_event_id", providerEventId)
        .maybeSingle();
      if (raced) return { id: (raced as { id: string }).id, isNew: false };
    }
    logger.error("email_event.insert_failed", {
      event: EMAIL_EVENT,
      status: "error",
      error_message: error?.message ?? "unknown",
    });
    throw Errors.internal("Could not record the email event.");
  }

  return { id: (data as { id: string }).id, isNew: true };
}

export async function finishEmailEvent(
  id: string,
  status: "processed" | "ignored" | "failed" | "unverified",
  error: string | null = null,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("email_events")
    .update({
      processed_at: status === "processed" || status === "ignored" ? new Date().toISOString() : null,
      error,
    } as never)
    .eq("id", id);
}

/**
 * Applies the event's side effects. Called only after signature verification
 * succeeded and only for a genuinely new provider event id.
 */
export async function applyEmailEvent(event: ResendEmailEvent): Promise<{ applied: boolean; reason?: string }> {
  const admin = createAdminClient();

  if (!STATEFUL.has(event.type)) {
    return { applied: false, reason: "unhandled_event_type" };
  }

  const email = event.data.to?.[0]?.toLowerCase() ?? null;
  const taggedCampaignId = event.data.tags?.campaign_id ?? null;
  const taggedWorkspaceId = event.data.tags?.workspace_id ?? null;

  // Resolve the recipient row. Tags are the primary signal (we set them when
  // sending); the address alone is the fallback for mail sent without one.
  const recipient = await findRecipient({
    campaignId: taggedCampaignId,
    workspaceId: taggedWorkspaceId,
    email,
    messageId: event.data.message_id ?? null,
  });

  const workspaceId = recipient?.workspace_id ?? taggedWorkspaceId ?? null;
  const campaignId = recipient?.campaign_id ?? taggedCampaignId ?? null;
  const now = new Date().toISOString();

  switch (event.type) {
    case "email.delivered": {
      if (!recipient) break;
      await admin
        .from("campaign_leads")
        .update({ status: "delivered", delivered_at: now, updated_at: now } as never)
        .eq("id", recipient.id)
        // Never let a late delivery overwrite a reply or a bounce.
        .in("status", ["sent", "scheduled"]);
      await bumpCampaignStat(campaignId, "delivered");
      break;
    }

    case "email.opened": {
      if (!recipient) break;
      // Opens fire on every view; only the first one is meaningful.
      const { data: current } = await admin
        .from("campaign_leads")
        .select("opened_at")
        .eq("id", recipient.id)
        .maybeSingle();
      const already = (current as { opened_at: string | null } | null)?.opened_at;
      if (!already) {
        await admin
          .from("campaign_leads")
          .update({ status: "opened", opened_at: now, updated_at: now } as never)
          .eq("id", recipient.id)
          .in("status", ["sent", "delivered", "scheduled"]);
        await bumpCampaignStat(campaignId, "opened");
      }
      break;
    }

    case "email.clicked": {
      await bumpCampaignStat(campaignId, "clicked");
      break;
    }

    case "email.bounced": {
      if (workspaceId && email) {
        await addSuppression(workspaceId, email, "bounced", "resend_bounce");
      }
      if (recipient) {
        await admin
          .from("campaign_leads")
          .update({
            status: "bounced",
            bounced_at: now,
            last_error: event.data.bounce?.message ?? event.data.bounce?.type ?? "bounced",
            next_run_at: null,
            updated_at: now,
          } as never)
          .eq("id", recipient.id);
        await bumpCampaignStat(campaignId, "bounced");
      }
      break;
    }

    case "email.complained": {
      // A spam complaint is the strongest possible "stop" signal.
      if (workspaceId && email) {
        await addSuppression(workspaceId, email, "complained", "resend_complaint");
      }
      if (recipient) {
        await admin
          .from("campaign_leads")
          .update({
            status: "suppressed",
            last_error: "spam complaint",
            next_run_at: null,
            updated_at: now,
          } as never)
          .eq("id", recipient.id);
      }
      break;
    }

    case "email.failed": {
      if (recipient) {
        await admin
          .from("campaign_leads")
          .update({
            status: "failed",
            failed_at: now,
            last_error: event.data.failed?.reason ?? "delivery_failed",
            next_run_at: null,
            updated_at: now,
          } as never)
          .eq("id", recipient.id);
        await bumpCampaignStat(campaignId, "failed");
      }
      break;
    }

    case "email.suppressed": {
      // Resend refused to deliver (its own suppression list / domain block).
      if (workspaceId && email) {
        await addSuppression(workspaceId, email, event.data.suppressed?.type ?? "suppressed", "resend");
      }
      if (recipient) {
        await admin
          .from("campaign_leads")
          .update({
            status: "suppressed",
            last_error: event.data.suppressed?.message ?? "suppressed by provider",
            next_run_at: null,
            updated_at: now,
          } as never)
          .eq("id", recipient.id);
        await bumpCampaignStat(campaignId, "skipped");
      }
      break;
    }

    case "email.delivery_delayed":
    case "email.scheduled": {
      // Informational. The next delivered/bounced/failed event decides state.
      break;
    }

    default:
      return { applied: false, reason: "unhandled_event_type" };
  }

  if (workspaceId && (event.type === "email.bounced" || event.type === "email.complained")) {
    await notifyDeliverabilityProblem(workspaceId, event, email, campaignId);
  }

  return { applied: true };
}

/** Parses a webhook body. Returns null when it isn't a recognised email event. */
export function parseResendEvent(body: unknown): ResendEmailEvent | null {
  const result = emailEventSchema.safeParse(body);
  return result.success ? result.data : null;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface RecipientRow {
  id: string;
  workspace_id: string;
  campaign_id: string;
}

/**
 * Finds the `campaign_leads` row an event refers to.
 *
 * Order matters: a tagged campaign + address is unambiguous, so it wins. An
 * address-only lookup is scoped to a workspace and picks the most recent
 * recipient, because an address can appear in more than one campaign.
 */
async function findRecipient(params: {
  campaignId: string | null;
  workspaceId: string | null;
  email: string | null;
  messageId: string | null;
}): Promise<RecipientRow | null> {
  const admin = createAdminClient();

  if (params.campaignId && params.email) {
    const { data } = await admin
      .from("campaign_leads")
      .select("id, workspace_id, campaign_id")
      .eq("campaign_id", params.campaignId)
      .eq("email", params.email as never)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as RecipientRow;
  }

  if (params.workspaceId && params.email) {
    const { data } = await admin
      .from("campaign_leads")
      .select("id, workspace_id, campaign_id")
      .eq("workspace_id", params.workspaceId)
      .eq("email", params.email as never)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as RecipientRow;
  }

  return null;
}

/**
 * Adds an address to the workspace suppression list.
 *
 * Suppression is workspace-wide, not per campaign: an address that bounced once
 * is suppressed for every campaign, present and future.
 */
async function addSuppression(
  workspaceId: string,
  email: string,
  reason: string,
  source: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("suppression_entries")
    .upsert(
      {
        workspace_id: workspaceId,
        email: email as never,
        reason: reason.slice(0, 120),
        source,
      } as never,
      { onConflict: "workspace_id,email", ignoreDuplicates: true },
    );

  if (error) {
    logger.error("suppression.insert_failed", {
      event: EMAIL_EVENT,
      status: "error",
      error_message: error.message,
    });
  }
}

/**
 * Increments one counter inside `campaigns.stats` (a jsonb object).
 *
 * Read-modify-write rather than an RPC, because the counter is a small
 * denormalisation for display: the authoritative record is `email_events`, and
 * a lost race here under-reports a number on a dashboard, never a send.
 */
async function bumpCampaignStat(campaignId: string | null, key: string): Promise<void> {
  if (!campaignId) return;
  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("campaigns")
    .select("stats")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return;

  const stats = ((campaign as { stats: Record<string, number> | null }).stats ?? {}) as Record<string, number>;
  const next = { ...stats, [key]: (typeof stats[key] === "number" ? stats[key] : 0) + 1 };

  await admin.from("campaigns").update({ stats: next as never, updated_at: new Date().toISOString() } as never).eq("id", campaignId);
}

/** Surfaces a bounce/complaint to the workspace as an in-app notification. */
async function notifyDeliverabilityProblem(
  workspaceId: string,
  event: ResendEmailEvent,
  email: string | null,
  campaignId: string | null,
): Promise<void> {
  try {
    const { createNotification } = await import("@/server/services/notifications");
    await createNotification({
      workspaceId,
      type: "system",
      title: event.type === "email.complained" ? "Spam complaint received" : "Email bounced",
      body: email
        ? `${email} was suppressed after ${event.type === "email.complained" ? "a spam complaint" : "a bounce"}. It will not be contacted again.`
        : "An email was suppressed after a delivery problem.",
      href: campaignId ? `/campaigns/${campaignId}` : "/campaigns",
      severity: "warning",
      // One notification per address per hour, however many events arrive.
      dedupeKey: email
        ? `${event.type}:${email}:${Math.floor(Date.now() / 3_600_000)}`
        : null,
    });
  } catch (error) {
    logger.warn("notification.deliverability_failed", {
      event: EMAIL_EVENT,
      status: "error",
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}
