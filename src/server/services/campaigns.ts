import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { CampaignRow, CampaignStepRow, CampaignLeadRow, MailboxRow } from "@/types/database";

/**
 * Campaign service (§22).
 *
 * All sending happens server-side. The browser can create, pause and schedule a
 * campaign, but no client code ever talks to the email provider.
 */

export async function listCampaigns(workspaceId: string): Promise<CampaignRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as CampaignRow[] | null) ?? [];
}

export async function getCampaign(workspaceId: string, campaignId: string): Promise<CampaignRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as CampaignRow | null) ?? null;
}

export async function getCampaignSteps(workspaceId: string, campaignId: string): Promise<CampaignStepRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_steps")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });
  return (data as CampaignStepRow[] | null) ?? [];
}

export async function createCampaign(params: {
  workspaceId: string;
  userId: string;
  input: {
    name: string;
    description?: string | null;
    mailboxId?: string | null;
    dailyLimit?: number;
    stopOnReply?: boolean;
    scheduledAt?: string | null;
    timezone?: string;
  };
}): Promise<CampaignRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: params.workspaceId,
      created_by: params.userId,
      name: params.input.name,
      description: params.input.description ?? null,
      mailbox_id: params.input.mailboxId ?? null,
      status: params.input.scheduledAt ? "scheduled" : "draft",
      scheduled_at: params.input.scheduledAt ?? null,
      daily_limit: params.input.dailyLimit ?? 200,
      stop_on_reply: params.input.stopOnReply ?? true,
      timezone: params.input.timezone ?? "UTC",
    } as never)
    .select("*")
    .single();

  if (error || !data) throw Errors.internal("Could not create that campaign.");
  return data as CampaignRow;
}

export async function updateCampaign(
  workspaceId: string,
  campaignId: string,
  patch: Partial<Pick<CampaignRow, "name" | "description" | "mailbox_id" | "daily_limit" | "stop_on_reply" | "timezone" | "scheduled_at">>,
): Promise<CampaignRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  if (error || !data) throw Errors.internal("Could not update that campaign.");
  return data as CampaignRow;
}

export async function deleteCampaign(workspaceId: string, campaignId: string): Promise<void> {
  const supabase = await createClient();
  // Soft-delete, and stop the queue: any pending recipient rows are cancelled so
  // a deleted campaign can't keep sending from the cron worker.
  await supabase
    .from("campaign_leads")
    .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
    .eq("campaign_id", campaignId)
    .eq("workspace_id", workspaceId)
    .in("status", ["pending", "scheduled"]);

  await supabase
    .from("campaigns")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" } as never)
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId);
}

export async function upsertSteps(
  workspaceId: string,
  campaignId: string,
  steps: { kind: "email" | "wait" | "condition"; subject?: string | null; body?: string | null; delayMinutes?: number; conditions?: Record<string, unknown> }[],
): Promise<CampaignStepRow[]> {
  const supabase = await createClient();
  await supabase.from("campaign_steps").delete().eq("campaign_id", campaignId);

  const rows = steps.map((step, index) => ({
    campaign_id: campaignId,
    workspace_id: workspaceId,
    position: index + 1,
    kind: step.kind,
    subject: step.subject ?? null,
    body: step.body ?? null,
    delay_minutes: step.delayMinutes ?? 0,
    conditions: (step.conditions ?? {}) as never,
  }));

  const { data, error } = await supabase
    .from("campaign_steps")
    .insert(rows as never)
    .select("*");

  if (error) throw Errors.internal("Could not save those steps.");
  return (data as CampaignStepRow[] | null) ?? [];
}

export async function addLeadsToCampaign(params: {
  workspaceId: string;
  campaignId: string;
  leadIds: string[];
}): Promise<{ added: number; skipped: number }> {
  const supabase = await createClient();

  const { data: suppressed } = await supabase
    .from("suppression_entries")
    .select("email")
    .eq("workspace_id", params.workspaceId);
  const suppressedEmails = new Set(
    ((suppressed ?? []) as { email: string }[]).map((s) => s.email.toLowerCase()),
  );

  const { data: leads } = await supabase
    .from("leads")
    .select("id, primary_email")
    .eq("workspace_id", params.workspaceId)
    .in("id", params.leadIds)
    .is("deleted_at", null);

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const lead of (leads ?? []) as { id: string; primary_email: string | null }[]) {
    const email = lead.primary_email?.toLowerCase();
    if (!email || suppressedEmails.has(email)) {
      skipped += 1;
      continue;
    }
    rows.push({
      campaign_id: params.campaignId,
      lead_id: lead.id,
      workspace_id: params.workspaceId,
      email,
      status: "pending",
      current_step: 1,
      // Stable across retries so a retry can never double-send (§22).
      idempotency_key: `campaign:${params.campaignId}:lead:${lead.id}:step:1`,
    });
  }

  if (rows.length === 0) return { added: 0, skipped };

  const { data, error } = await supabase
    .from("campaign_leads")
    .upsert(rows as never, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true })
    .select("id");

  if (error) throw Errors.internal("Could not add those leads.");
  return { added: (data ?? []).length, skipped };
}

export async function listCampaignLeads(
  workspaceId: string,
  campaignId: string,
  limit = 100,
): Promise<CampaignLeadRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_leads")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data as CampaignLeadRow[] | null) ?? [];
}

export async function setCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: "draft" | "scheduled" | "running" | "paused" | "cancelled",
): Promise<CampaignRow> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "running") patch.started_at = new Date().toISOString();
  if (status === "paused") patch.paused_at = new Date().toISOString();
  if (status === "cancelled") patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("campaigns")
    .update(patch as never)
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  if (error || !data) throw Errors.internal("Could not update that campaign.");
  return data as CampaignRow;
}

/**
 * Sends due recipients. Server-side only, idempotent per (campaign, lead, step),
 * rate limited by the mailbox daily cap, and suppression-aware (§22).
 */
export async function sendDueCampaignSteps(limit = 50): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();

  const { data: due, error } = await admin
    .from("campaign_leads")
    .select("*, campaign:campaigns(*), lead:leads(*)")
    .in("status", ["pending", "scheduled"])
    .lte("next_run_at", new Date().toISOString())
    .limit(limit);

  if (error || !due || due.length === 0) return { sent: 0, failed: 0 };

  // Pending rows created before scheduling get their first run time now.
  const now = new Date().toISOString();
  await admin
    .from("campaign_leads")
    .update({ status: "scheduled", next_run_at: now } as never)
    .in("status", ["pending"])
    .is("next_run_at", null);

  let sent = 0;
  let failed = 0;

  for (const row of due as unknown as CampaignLeadRow[]) {
    const campaign = (row as unknown as { campaign: CampaignRow | null }).campaign;
    const lead = (row as unknown as { lead: { id: string; business_name: string } | null }).lead;
    if (!campaign || campaign.status !== "running" || !lead) continue;

    const steps = await getCampaignStepsForSend(admin, campaign.id);
    const step = steps[row.current_step - 1];
    if (!step || step.kind !== "email") continue;

    const mailbox = campaign.mailbox_id ? await getMailbox(admin, campaign.mailbox_id) : null;
    const from = mailbox?.email ?? process.env.EMAIL_FROM ?? "zybble <no-reply@updates.zybble.app>";

    // Daily cap is enforced server-side, per mailbox (§22 rate limiting).
    if (mailbox && mailbox.sent_today >= mailbox.daily_send_limit) continue;

    const { sendEmail, unsubscribeFooter } = await import("@/server/services/email");
    const { renderTemplate } = await import("@/lib/personalization");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const body = renderTemplate(step.body ?? "", {
      business_name: lead.business_name,
      first_name: lead.business_name.split(" ")[0],
      city: "",
      category: "",
      website: "",
      sender_name: mailbox?.name ?? "zybble",
    }) + unsubscribeFooter(row.unsubscribe_token, siteUrl);

    const result = await sendEmail({
      to: row.email,
      subject: renderTemplate(step.subject ?? "", { business_name: lead.business_name }),
      html: `<div style="font-family:Inter,sans-serif;white-space:pre-wrap;">${escapeHtml(body)}</div>`,
      // Campaign mail goes out under the mailbox the campaign is bound to —
      // that is exactly the address mailbox verification verifies.
      from: from,
      // Same key as the DB idempotency_key: retries cannot double-send.
      idempotencyKey: `campaign:${campaign.id}:lead:${row.lead_id}:step:${row.current_step}`,
      tags: [
        { name: "campaign_id", value: campaign.id },
        { name: "workspace_id", value: campaign.workspace_id },
      ],
    });

    if (result.ok) {
      sent += 1;
      await admin
        .from("campaign_leads")
        .update({
          status: "sent",
          sent_at: now,
          attempts: row.attempts + 1,
          updated_at: now,
        } as never)
        .eq("id", row.id);
      if (mailbox) {
        await admin
          .from("mailboxes")
          .update({ sent_today: mailbox.sent_today + 1 } as never)
          .eq("id", mailbox.id);
      }
      await admin
        .from("campaigns")
        .update({ stats: { ...(campaign.stats as object), sent: ((campaign.stats as { sent?: number })?.sent ?? 0) + 1 } } as never)
        .eq("id", campaign.id);
    } else {
      failed += 1;
      await admin
        .from("campaign_leads")
        .update({
          status: row.attempts + 1 >= 3 ? "failed" : "scheduled",
          attempts: row.attempts + 1,
          last_error: result.error ?? "send_failed",
          failed_at: row.attempts + 1 >= 3 ? now : null,
          next_run_at: row.attempts + 1 >= 3 ? null : new Date(Date.now() + backoff(row.attempts)).toISOString(),
          updated_at: now,
        } as never)
        .eq("id", row.id);
    }
  }

  return { sent, failed };
}

export function backoff(attempts: number): number {
  return Math.min(60 * 60 * 1000, 2 ** attempts * 60 * 1000);
}

async function getCampaignStepsForSend(admin: ReturnType<typeof createAdminClient>, campaignId: string) {
  const { data } = await admin
    .from("campaign_steps")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });
  return (data as CampaignStepRow[] | null) ?? [];
}

async function getMailbox(admin: ReturnType<typeof createAdminClient>, mailboxId: string) {
  const { data } = await admin.from("mailboxes").select("*").eq("id", mailboxId).maybeSingle();
  return (data as MailboxRow | null) ?? null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Recomputes the denormalised stats block from the recipient rows. */
export async function recomputeCampaignStats(workspaceId: string, campaignId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("campaign_leads")
    .select("status")
    .eq("campaign_id", campaignId)
    .eq("workspace_id", workspaceId);

  const stats = {
    recipients: 0, sent: 0, delivered: 0, opened: 0, replied: 0,
    bounced: 0, failed: 0, skipped: 0,
  };

  for (const row of (data ?? []) as { status: string }[]) {
    stats.recipients += 1;
    if (row.status in stats) stats[row.status as keyof typeof stats] += 1;
    if (row.status === "sent") stats.sent += 1;
  }

  await admin.from("campaigns").update({ stats: stats as never } as never).eq("id", campaignId);
}

/** Unsubscribe — public route, executed with service role (§22). */
export async function unsubscribe(token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("campaign_leads")
    .select("id, email, workspace_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!data) return false;
  const row = data as { id: string; email: string; workspace_id: string };

  await admin.from("suppression_entries").upsert(
    {
      workspace_id: row.workspace_id,
      email: row.email as never,
      reason: "unsubscribed",
      source: "unsubscribe_link",
    } as never,
    { onConflict: "workspace_id,email", ignoreDuplicates: true },
  );

  await admin
    .from("campaign_leads")
    .update({ status: "unsubscribed", updated_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  logger.info("campaign.unsubscribed", {
    workspace_id: row.workspace_id,
    event: "campaign.unsubscribe",
    status: "ok",
  });
  return true;
}

// ---------------------------------------------------------------------------
// Mailboxes (§23)
// ---------------------------------------------------------------------------

/**
 * SMTP credentials are encrypted at rest with AES-256-GCM using
 * `MAILBOX_ENCRYPTION_KEY`. The ciphertext, IV and auth tag are stored
 * base64-packed together so a rotation only needs to re-wrap rows, not change
 * the column. The plaintext is never returned to the browser — the API only
 * ever reports whether a password is set.
 */

const AES_ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const raw = process.env.MAILBOX_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw Errors.dependency(
      "MAILBOX_ENCRYPTION_KEY must be set to at least 32 characters to store SMTP credentials.",
    );
  }
  // Derive a stable 32-byte key from the configured secret.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(packed: string): string {
  const [ivB64, tagB64, dataB64] = packed.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw Errors.internal("Stored SMTP secret is malformed.");
  const decipher = createDecipheriv(AES_ALGORITHM, encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}

/** Mailbox shape that is safe to serialise to the browser. */
export interface MailboxView {
  id: string;
  name: string;
  email: string;
  provider: string;
  status: string;
  dailySendLimit: number;
  sentToday: number;
  verifiedAt: string | null;
  lastError: string | null;
  hasSmtpPassword: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  createdAt: string;
}

function toMailboxView(row: MailboxRow): MailboxView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    provider: row.provider,
    status: row.status,
    dailySendLimit: Number(row.daily_send_limit),
    sentToday: Number(row.sent_today),
    verifiedAt: row.verified_at,
    lastError: row.last_error,
    // Never leak the ciphertext or the plaintext.
    hasSmtpPassword: Boolean(row.smtp_password_encrypted),
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpUsername: row.smtp_username,
    createdAt: row.created_at,
  };
}

export async function listMailboxes(workspaceId: string): Promise<MailboxView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mailboxes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return ((data as MailboxRow[] | null) ?? []).map(toMailboxView);
}

export async function createMailbox(params: {
  workspaceId: string;
  userId: string;
  input: {
    name: string;
    email: string;
    provider: "resend" | "smtp";
    dailySendLimit: number;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpUsername?: string | null;
    smtpPassword?: string | null;
  };
}): Promise<MailboxView> {
  const supabase = await createClient();
  const encrypted = params.input.smtpPassword ? encryptSecret(params.input.smtpPassword) : null;

  const { data, error } = await supabase
    .from("mailboxes")
    .insert({
      workspace_id: params.workspaceId,
      created_by: params.userId,
      name: params.input.name,
      email: params.input.email,
      provider: params.input.provider,
      daily_send_limit: params.input.dailySendLimit,
      smtp_host: params.input.smtpHost ?? null,
      smtp_port: params.input.smtpPort ?? null,
      smtp_username: params.input.smtpUsername ?? null,
      smtp_password_encrypted: encrypted,
      status: "pending",
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw Errors.conflict("A mailbox with that email already exists.");
    throw Errors.internal("Could not create that mailbox.");
  }
  return toMailboxView(data as MailboxRow);
}

export async function updateMailbox(
  workspaceId: string,
  mailboxId: string,
  input: {
    name?: string;
    dailySendLimit?: number;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpUsername?: string | null;
    smtpPassword?: string | null;
  },
): Promise<MailboxView> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.dailySendLimit !== undefined) patch.daily_send_limit = input.dailySendLimit;
  if (input.smtpHost !== undefined) patch.smtp_host = input.smtpHost;
  if (input.smtpPort !== undefined) patch.smtp_port = input.smtpPort;
  if (input.smtpUsername !== undefined) patch.smtp_username = input.smtpUsername;
  if (input.smtpPassword) patch.smtp_password_encrypted = encryptSecret(input.smtpPassword);

  const { data, error } = await supabase
    .from("mailboxes")
    .update(patch as never)
    .eq("id", mailboxId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  if (error || !data) throw Errors.internal("Could not update that mailbox.");
  return toMailboxView(data as MailboxRow);
}

export async function deleteMailbox(workspaceId: string, mailboxId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("mailboxes")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", mailboxId)
    .eq("workspace_id", workspaceId);
}

/**
 * Marks a mailbox verified. Real verification is provider-specific: Resend
 * domains must be verified in the Resend dashboard, so we only flip the flag
 * when the domain is present in `RESEND_VERIFIED_DOMAINS` (or when the operator
 * has explicitly allowed self-assertion in dev mode).
 */
export async function verifyMailbox(
  workspaceId: string,
  mailboxId: string,
): Promise<MailboxView> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("mailboxes")
    .select("*")
    .eq("id", mailboxId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!row) throw Errors.notFound("Mailbox not found.");

  const mailbox = row as MailboxRow;
  const domain = mailbox.email.split("@")[1]?.toLowerCase() ?? "";
  const allowed = (process.env.RESEND_VERIFIED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const verified = process.env.NODE_ENV === "development" || allowed.includes(domain);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    verified_at: verified ? new Date().toISOString() : null,
    status: verified ? "verified" : "pending",
    last_error: verified
      ? null
      : `Domain "${domain}" is not verified with the email provider. Add and verify it, then retry.`,
  };

  const { data, error } = await supabase
    .from("mailboxes")
    .update(patch as never)
    .eq("id", mailboxId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  if (error || !data) throw Errors.internal("Could not verify that mailbox.");
  return toMailboxView(data as MailboxRow);
}

// ---------------------------------------------------------------------------
// Campaign activity feed
// ---------------------------------------------------------------------------

export interface CampaignActivityItem {
  id: string;
  email: string;
  status: string;
  currentStep: number;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  bouncedAt: string | null;
  failedAt: string | null;
  leadId: string;
  businessName: string | null;
}

/** Recent per-recipient activity, joined to the lead for a readable name. */
export async function listCampaignActivity(
  workspaceId: string,
  campaignId: string,
  limit = 100,
): Promise<CampaignActivityItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_leads")
    .select("*, lead:leads(business_name)")
    .eq("campaign_id", campaignId)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as (CampaignLeadRow & {
    lead: { business_name: string | null } | null;
  })[];

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    status: r.status,
    currentStep: Number(r.current_step),
    attempts: Number(r.attempts),
    lastError: r.last_error,
    sentAt: r.sent_at,
    repliedAt: r.replied_at,
    bouncedAt: r.bounced_at,
    failedAt: r.failed_at,
    leadId: r.lead_id,
    businessName: r.lead?.business_name ?? null,
  }));
}

export async function removeLeadsFromCampaign(params: {
  workspaceId: string;
  campaignId: string;
  leadIds: string[];
}): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_leads")
    .delete()
    .eq("campaign_id", params.campaignId)
    .eq("workspace_id", params.workspaceId)
    .in("lead_id", params.leadIds)
    .select("id");
  await recomputeCampaignStats(params.workspaceId, params.campaignId);
  return (data ?? []).length;
}
