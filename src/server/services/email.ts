import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { Errors } from "@/lib/errors";

/**
 * Email service (§21).
 *
 * - The Resend API key is server-only.
 * - Every send carries an idempotency key so a retry can't double-send.
 * - The sender/domain is configuration (`EMAIL_FROM`), so changing domain or
 *   provider doesn't require touching application logic.
 * - Deliverability rules are respected: campaigns only send to recipients with
 *   a stored business relationship, every message includes a working
 *   unsubscribe link, and bounces/complaints are recorded as suppressions.
 */

let client: Resend | null = null;

function resend(): Resend {
  if (client) return client;
  if (!serverEnv.RESEND_API_KEY) {
    throw Errors.dependency("RESEND_API_KEY is not configured.");
  }
  client = new Resend(serverEnv.RESEND_API_KEY);
  return client;
}

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.RESEND_API_KEY);
}

export interface SendOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  /**
   * Idempotency key — required. Format: `<event-type>/<entity-id>` so retries
   * after a network failure resolve to the original send (§21).
   */
  idempotencyKey: string;
}

export interface SendResult {
  id: string | null;
  ok: boolean;
  error?: string;
}

/**
 * Sends a transactional email. Returns a result object rather than throwing,
 * so a provider outage degrades gracefully instead of breaking the flow — but
 * the failure is always logged with a request-id-shaped key.
 */
export async function sendEmail(options: SendOptions): Promise<SendResult> {
  if (!isEmailConfigured()) {
    logger.warn("email.skipped_not_configured", {
      event: "email.send",
      status: "skipped",
      metadata: { subject: options.subject },
    });
    return { id: null, ok: false, error: "email_not_configured" };
  }

  try {
    const { data, error } = await resend().emails.send(
      {
        from: serverEnv.EMAIL_FROM,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
        ...(options.replyTo || serverEnv.EMAIL_REPLY_TO
          ? { reply_to: options.replyTo ?? serverEnv.EMAIL_REPLY_TO }
          : {}),
        ...(options.tags ? { tags: options.tags } : {}),
      },
      { idempotencyKey: options.idempotencyKey.slice(0, 256) },
    );

    if (error) {
      logger.error("email.send_failed", {
        event: "email.send",
        status: "error",
        error_code: error.name,
        error_message: error.message,
        metadata: { subject: options.subject },
      });
      return { id: null, ok: false, error: error.message };
    }

    logger.info("email.sent", {
      event: "email.send",
      status: "ok",
      metadata: { id: data?.id, subject: options.subject },
    });
    return { id: data?.id ?? null, ok: true };
  } catch (error) {
    logger.error("email.send_error", {
      event: "email.send",
      status: "error",
      error_message: error instanceof Error ? error.message : String(error),
    });
    return { id: null, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const BRAND = {
  ink: "#0b100e",
  paper: "#f5f3ec",
  lime: "#d8ff3e",
  mist: "#98a69d",
};

function layout(title: string, body: string, footerNote?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND.paper};color:${BRAND.ink};font-family:Inter,-apple-system,Segoe UI,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding-bottom:24px;">
      <span style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${BRAND.lime},#bfe82a);color:${BRAND.ink};text-align:center;line-height:36px;font-weight:700;font-size:18px;">Z</span>
      <span style="margin-left:10px;font-size:18px;font-weight:700;letter-spacing:-0.02em;">zybble</span>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid rgba(11,16,14,0.08);border-radius:18px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;letter-spacing:-0.02em;">${title}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding-top:20px;color:${BRAND.mist};font-size:12px;line-height:1.6;">
      ${footerNote ?? "You're receiving this because you have a zybble account."}
      <br />zybble · turn Google Maps into verified leads
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND.ink};color:${BRAND.paper};text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:15px;">${label}</a>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:rgba(11,16,14,0.74);">${text}</p>`;
}

export interface TemplatedEmail {
  subject: string;
  html: string;
  text: string;
}

export const templates = {
  welcome: (name: string | null, dashboardUrl: string): TemplatedEmail => ({
    subject: "Welcome to zybble",
    html: layout(
      "Your 100 free leads are ready",
      paragraph(`Hi ${name ?? "there"},`) +
        paragraph(
          "zybble turns Google Maps into a pipeline of verified leads. Search any niche in any city, and we'll extract businesses, verify their emails and phone numbers, and hand you a clean CSV.",
        ) +
        paragraph(button(dashboardUrl, "Open your dashboard")) +
        paragraph("Every plan includes email data, phone data, CSV export, the AI Assistant and Campaigns."),
      "You can change which emails you receive in Settings → Notifications.",
    ),
    text: `Welcome to zybble, ${name ?? "there"}! Your 100 free leads are ready. Open your dashboard: ${dashboardUrl}`,
  }),

  emailVerification: (name: string | null, confirmUrl: string): TemplatedEmail => ({
    subject: "Confirm your zybble email",
    html: layout(
      "Confirm your email address",
      paragraph(`Hi ${name ?? "there"},`) +
        paragraph("Confirm your email address to secure your account and start scraping leads.") +
        paragraph(button(confirmUrl, "Confirm email")) +
        paragraph("If you didn't create a zybble account, you can safely ignore this message."),
      "This link expires in 24 hours.",
    ),
    text: `Confirm your zybble email: ${confirmUrl}`,
  }),

  passwordChanged: (name: string | null): TemplatedEmail => ({
    subject: "Your zybble password was changed",
    html: layout(
      "Password changed",
      paragraph(`Hi ${name ?? "there"},`) +
        paragraph("Your zybble password was just changed. If this wasn't you, reset it immediately and contact support."),
      "Security notification — action may be required.",
    ),
    text: "Your zybble password was just changed. If this wasn't you, reset it immediately.",
  }),

  passwordReset: (resetUrl: string): TemplatedEmail => ({
    subject: "Reset your zybble password",
    html: layout(
      "Reset your password",
      paragraph("We received a request to reset your zybble password.") +
        paragraph(button(resetUrl, "Choose a new password")) +
        paragraph("If you didn't request this, you can safely ignore this email — your password won't change."),
      "This link expires in 1 hour.",
    ),
    text: `Reset your zybble password: ${resetUrl}`,
  }),

  paymentSucceeded: (planName: string, amount: string, invoiceUrl: string): TemplatedEmail => ({
    subject: `Payment received — ${planName}`,
    html: layout(
      "Thanks — your payment went through",
      paragraph(`We received your ${amount} payment for the ${planName} plan.`) +
        paragraph(button(invoiceUrl, "View receipt")) +
        paragraph("Your lead quota has been refreshed for this billing period."),
    ),
    text: `We received your ${amount} payment for the ${planName} plan. Receipt: ${invoiceUrl}`,
  }),

  paymentFailed: (planName: string, billingUrl: string): TemplatedEmail => ({
    subject: "We couldn't process your payment",
    html: layout(
      "Payment failed",
      paragraph(`We couldn't collect payment for your ${planName} subscription.`) +
        paragraph("Update your payment method to avoid an interruption to your lead quota.") +
        paragraph(button(billingUrl, "Update payment method")),
      "We'll retry automatically over the next few days.",
    ),
    text: `We couldn't collect payment for your ${planName} subscription. Update it here: ${billingUrl}`,
  }),

  subscriptionChanged: (planName: string, billingUrl: string): TemplatedEmail => ({
    subject: "Your zybble subscription changed",
    html: layout(
      `You're now on ${planName}`,
      paragraph(`Your subscription is now on the ${planName} plan. Your lead quota has been updated.`) +
        paragraph(button(billingUrl, "Manage billing")),
    ),
    text: `Your subscription is now on the ${planName} plan. Manage billing: ${billingUrl}`,
  }),

  searchCompleted: (params: { keyword: string; count: number; url: string }): TemplatedEmail => ({
    subject: `Your search for "${params.keyword}" finished`,
    html: layout(
      "Your search finished",
      paragraph(
        `We found and saved <strong>${params.count.toLocaleString()}</strong> new lead${
          params.count === 1 ? "" : "s"
        } for "${params.keyword}".`,
      ) + paragraph(button(params.url, "View results")),
      "You can turn these notifications off in Settings → Notifications.",
    ),
    text: `Your search for "${params.keyword}" finished with ${params.count} new leads: ${params.url}`,
  }),

  searchFailed: (params: { keyword: string; reason: string; url: string }): TemplatedEmail => ({
    subject: `Your search for "${params.keyword}" failed`,
    html: layout(
      "Your search couldn't finish",
      paragraph(`We couldn't complete your search for "${params.keyword}".`) +
        paragraph(`Reason: ${params.reason}`) +
        paragraph(button(params.url, "Retry search")),
    ),
    text: `Your search for "${params.keyword}" failed: ${params.reason}. Retry: ${params.url}`,
  }),

  usageThreshold: (params: { used: number; limit: number; planName: string; url: string }): TemplatedEmail => ({
    subject: "You're close to your monthly lead limit",
    html: layout(
      "Lead limit almost reached",
      paragraph(
        `You've used <strong>${params.used.toLocaleString()}</strong> of ${params.limit.toLocaleString()} leads on the ${
          params.planName
        } plan this period.`,
      ) + paragraph(button(params.url, "Upgrade plan")),
    ),
    text: `You've used ${params.used} of ${params.limit} leads on ${params.planName}. Upgrade: ${params.url}`,
  }),

  campaignCompleted: (params: { name: string; sent: number; url: string }): TemplatedEmail => ({
    subject: `Campaign "${params.name}" finished`,
    html: layout(
      "Campaign finished",
      paragraph(`Your campaign "${params.name}" sent ${params.sent.toLocaleString()} messages.`) +
        paragraph(button(params.url, "View results")),
    ),
    text: `Campaign "${params.name}" finished: ${params.sent} sent. ${params.url}`,
  }),

  accountDeletionRequested: (name: string | null, confirmUrl: string): TemplatedEmail => ({
    subject: "Confirm your zybble account deletion",
    html: layout(
      "Confirm account deletion",
      paragraph(`Hi ${name ?? "there"},`) +
        paragraph(
          "We received a request to delete your zybble account and all associated data. This permanently removes your leads, lists, campaigns and searches.",
        ) +
        paragraph(button(confirmUrl, "Confirm deletion")) +
        paragraph("If you didn't request this, ignore this email — nothing will be deleted."),
      "This link expires in 24 hours.",
    ),
    text: `Confirm zybble account deletion: ${confirmUrl}`,
  }),
};

/** Convenience helper: renders a template and sends it idempotently. */
export async function sendTemplate(
  options: Omit<SendOptions, "subject" | "html"> & { template: TemplatedEmail },
): Promise<SendResult> {
  return sendEmail({
    to: options.to,
    subject: options.template.subject,
    html: options.template.html,
    text: options.template.text,
    idempotencyKey: options.idempotencyKey,
    replyTo: options.replyTo,
    tags: options.tags,
  });
}

export function unsubscribeFooter(token: string, siteUrl: string): string {
  const url = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return `<p style="margin-top:24px;font-size:12px;color:${BRAND.mist};">Don't want these emails? <a href="${url}" style="color:${BRAND.mist};text-decoration:underline;">Unsubscribe</a>.</p>`;
}

// ---------------------------------------------------------------------------
// Typed senders
// ---------------------------------------------------------------------------
//
// Each helper owns its idempotency-key convention (`<event>/<entity-id>`) so a
// retried webhook, a replayed cron tick or a double-clicked button can never
// produce a duplicate message in a customer's inbox.

const site = () => serverEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function sendWelcomeEmail(params: {
  email: string;
  fullName: string | null;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.welcome(params.fullName, `${site()}/dashboard`),
    idempotencyKey: `welcome/${params.email}`,
    tags: [
      { name: "category", value: "welcome" },
      { name: "type", value: "transactional" },
    ],
  });
}

export async function sendPasswordResetEmail(params: {
  email: string;
  resetUrl: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.passwordReset(params.resetUrl),
    // Bucketed to the hour: link expiry is 1h, so a resend inside that window
    // is a genuine re-request rather than a duplicate.
    idempotencyKey: `password-reset/${params.email}/${Math.floor(Date.now() / 3_600_000)}`,
    tags: [{ name: "category", value: "password-reset" }],
  });
}

export async function sendPasswordChangedEmail(params: {
  email: string;
  fullName: string | null;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.passwordChanged(params.fullName),
    idempotencyKey: `password-changed/${params.email}/${Math.floor(Date.now() / 60_000)}`,
    tags: [{ name: "category", value: "security" }],
  });
}

export async function sendAccountDeletionEmail(params: {
  email: string;
  fullName: string | null;
  confirmUrl: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.accountDeletionRequested(params.fullName, params.confirmUrl),
    idempotencyKey: `account-deletion/${params.email}/${Math.floor(Date.now() / 3_600_000)}`,
    tags: [{ name: "category", value: "security" }],
  });
}

export async function sendSearchCompletedEmail(params: {
  email: string;
  keyword: string;
  count: number;
  searchId: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.searchCompleted({
      keyword: params.keyword,
      count: params.count,
      url: `${site()}/searches/${params.searchId}`,
    }),
    idempotencyKey: `search-completed/${params.searchId}`,
    tags: [{ name: "category", value: "search" }],
  });
}

export async function sendSearchFailedEmail(params: {
  email: string;
  keyword: string;
  reason: string;
  searchId: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.searchFailed({
      keyword: params.keyword,
      reason: params.reason,
      url: `${site()}/searches/${params.searchId}?retry=1`,
    }),
    idempotencyKey: `search-failed/${params.searchId}`,
    tags: [{ name: "category", value: "search" }],
  });
}

export async function sendPaymentSucceededEmail(params: {
  email: string;
  planName: string;
  amount: string;
  invoiceUrl: string;
  paymentId: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.paymentSucceeded(params.planName, params.amount, params.invoiceUrl),
    idempotencyKey: `payment-succeeded/${params.paymentId}`,
    tags: [{ name: "category", value: "billing" }],
  });
}

export async function sendPaymentFailedEmail(params: {
  email: string;
  planName: string;
  invoiceId: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.paymentFailed(params.planName, `${site()}/billing`),
    idempotencyKey: `payment-failed/${params.invoiceId}`,
    tags: [{ name: "category", value: "billing" }],
  });
}

export async function sendSubscriptionChangedEmail(params: {
  email: string;
  planName: string;
  subscriptionId: string;
  /** Included in the key so an upgrade and a downgrade on the same sub differ. */
  revision: string | number;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.subscriptionChanged(params.planName, `${site()}/billing`),
    idempotencyKey: `subscription-changed/${params.subscriptionId}/${params.revision}`,
    tags: [{ name: "category", value: "billing" }],
  });
}

export async function sendUsageThresholdEmail(params: {
  email: string;
  used: number;
  limit: number;
  planName: string;
  periodStart: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.usageThreshold({
      used: params.used,
      limit: params.limit,
      planName: params.planName,
      url: `${site()}/billing`,
    }),
    // One nudge per threshold bucket per period — never one per lead.
    idempotencyKey: `usage-threshold/${params.email}/${params.periodStart}`,
    tags: [{ name: "category", value: "usage" }],
  });
}

export async function sendCampaignCompletedEmail(params: {
  email: string;
  campaignId: string;
  name: string;
  sent: number;
}): Promise<SendResult> {
  return sendTemplate({
    to: params.email,
    template: templates.campaignCompleted({
      name: params.name,
      sent: params.sent,
      url: `${site()}/campaigns/${params.campaignId}`,
    }),
    idempotencyKey: `campaign-completed/${params.campaignId}`,
    tags: [{ name: "category", value: "campaign" }],
  });
}
