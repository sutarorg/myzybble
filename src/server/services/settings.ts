import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { sendAccountDeletionEmail } from "./email";
import type { ProfileRow, WorkspaceRow, WorkspaceMemberRow } from "@/types/database";

/**
 * Settings service (§26).
 *
 * Reads go through the cookie-bound user client so RLS applies. Writes that
 * must survive RLS edge cases (account deletion touches several tables) use the
 * service-role client but are always scoped to the caller's own id, never an
 * id taken from the request body.
 */

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: {
    fullName?: string | null;
    company?: string | null;
    timezone?: string;
    productEmailOptIn?: boolean;
    marketingOptIn?: boolean;
    dataRetentionDays?: number;
  },
): Promise<ProfileRow> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.company !== undefined) update.company = patch.company;
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.productEmailOptIn !== undefined) update.product_email_opt_in = patch.productEmailOptIn;
  if (patch.marketingOptIn !== undefined) update.marketing_opt_in = patch.marketingOptIn;
  if (patch.dataRetentionDays !== undefined) update.data_retention_days = patch.dataRetentionDays;

  const { data, error } = await supabase
    .from("profiles")
    .update(update as never)
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !data) throw Errors.internal("Could not save your profile.");
  return data as ProfileRow;
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();
  return (data as WorkspaceRow | null) ?? null;
}

export interface MemberView {
  userId: string;
  role: string;
  email: string;
  fullName: string | null;
  joinedAt: string;
}

export async function listMembers(workspaceId: string): Promise<MemberView[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  const rows = (members as WorkspaceMemberRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in(
      "id",
      rows.map((r) => r.user_id),
    );

  const byId = new Map(
    ((profiles ?? []) as { id: string; email: string; full_name: string | null }[]).map((p) => [
      p.id,
      p,
    ]),
  );

  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
    email: byId.get(row.user_id)?.email ?? "(unknown)",
    fullName: byId.get(row.user_id)?.full_name ?? null,
    joinedAt: row.created_at,
  }));
}

export async function updateWorkspace(
  workspaceId: string,
  patch: { name?: string; billingEmail?: string | null },
): Promise<WorkspaceRow> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.billingEmail !== undefined) update.billing_email = patch.billingEmail;

  const { data, error } = await supabase
    .from("workspaces")
    .update(update as never)
    .eq("id", workspaceId)
    .select("*")
    .single();
  if (error || !data) throw Errors.internal("Could not save those workspace settings.");
  return data as WorkspaceRow;
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export type NotificationPrefs = {
  searchCompleted: boolean;
  searchFailed: boolean;
  subscriptionChanged: boolean;
  paymentFailed: boolean;
  campaignCompleted: boolean;
  usageThreshold: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
};

/** Mirrors `default_notification_preferences()` in migration 0014. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  searchCompleted: true,
  searchFailed: true,
  subscriptionChanged: true,
  paymentFailed: true,
  campaignCompleted: true,
  usageThreshold: true,
  securityAlerts: true,
  productUpdates: false,
};

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  const stored = (data as { preferences: Partial<NotificationPrefs> } | null)?.preferences;
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(stored ?? {}) };
}

export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const current = await getNotificationPrefs(userId);
  const next = { ...current, ...patch };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, preferences: next as never, updated_at: new Date().toISOString() } as never, {
      onConflict: "user_id",
    });
  if (error) throw Errors.internal("Could not save your notification preferences.");
  return next;
}

/**
 * True when the user wants this kind of email. Called by every sender so an
 * opted-out user is never emailed, even if a webhook fires (§21, §25).
 */
export async function wantsEmail(userId: string, kind: keyof NotificationPrefs): Promise<boolean> {
  try {
    const prefs = await getNotificationPrefs(userId);
    return Boolean(prefs[kind]);
  } catch {
    // Default to sending anything important rather than silently dropping it.
    return true;
  }
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
  docsUrl: string;
}

/**
 * Capability report for Settings → Integrations. Deliberately returns only
 * booleans — no key, secret, host or endpoint is ever sent to the browser.
 */
export async function integrationStatus(workspaceId: string): Promise<IntegrationStatus[]> {
  const supabase = await createClient();

  const [{ count: mailboxCount }, { count: verifiedMailboxes }] = await Promise.all([
    supabase
      .from("mailboxes")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase
      .from("mailboxes")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "verified")
      .is("deleted_at", null),
  ]);

  return [
    {
      key: "supabase",
      label: "Supabase",
      configured: Boolean(
        serverEnv.NEXT_PUBLIC_SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      ),
      detail: "Auth, Postgres, RLS and Realtime.",
      docsUrl: "https://supabase.com/dashboard/project/_/settings/api",
    },
    {
      key: "razorpay",
      label: "Razorpay",
      configured: Boolean(
        serverEnv.RAZORPAY_KEY_ID && serverEnv.RAZORPAY_KEY_SECRET && serverEnv.RAZORPAY_WEBHOOK_SECRET,
      ),
      detail: "USD subscriptions. International payments must be enabled on your account.",
      docsUrl: "https://dashboard.razorpay.com/app/website-app-settings/webhooks",
    },
    {
      key: "resend",
      label: "Resend",
      configured: Boolean(serverEnv.RESEND_API_KEY),
      detail: serverEnv.EMAIL_FROM
        ? `Sending as ${serverEnv.EMAIL_FROM}. The domain must be verified.`
        : "Set EMAIL_FROM so messages come from your domain.",
      docsUrl: "https://resend.com/domains",
    },
    {
      key: "gemini",
      label: "Google Gemini",
      configured: Boolean(serverEnv.GEMINI_API_KEY),
      detail: "Powers the AI Assistant. The key is server-only.",
      docsUrl: "https://aistudio.google.com/apikey",
    },
    {
      key: "mailboxes",
      label: "Sending mailboxes",
      configured: (verifiedMailboxes ?? 0) > 0,
      detail: `${mailboxCount ?? 0} configured, ${verifiedMailboxes ?? 0} verified.`,
      docsUrl: "/mailboxes",
    },
    {
      key: "worker",
      label: "Scraper worker",
      configured: Boolean(serverEnv.WORKER_BASE_URL && serverEnv.WORKER_SHARED_SECRET),
      detail: "Railway service that runs Google Maps searches.",
      docsUrl: "/docs/operations",
    },
  ];
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/**
 * Step 1: verify the password, mark the profile as pending deletion, email a
 * one-time confirmation link. Nothing is deleted yet.
 */
export async function requestAccountDeletion(params: {
  userId: string;
  email: string;
  fullName: string | null;
  password: string;
}): Promise<void> {
  const supabase = await createClient();

  // Re-authenticate before a destructive action.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (signInError) {
    throw Errors.validation("That password is incorrect.");
  }

  const admin = createAdminClient();
  const { data: tokenRow } = await admin.rpc("create_account_deletion_token", {
    p_user_id: params.userId,
  });
  const token = (tokenRow as string | null) ?? "";
  if (!token) throw Errors.internal("Could not start account deletion.");

  await sendAccountDeletionEmail({
    email: params.email,
    fullName: params.fullName,
    confirmUrl: `${serverEnv.NEXT_PUBLIC_SITE_URL}/settings/profile?delete=${encodeURIComponent(token)}`,
  });

  logger.info("account.deletion_requested", { user_id: params.userId });
}

/**
 * Step 2: consume the one-time token and delete the auth user. Cascades remove
 * the profile, workspace membership and all owned rows (§26).
 */
export async function confirmAccountDeletion(params: {
  userId: string;
  token: string;
}): Promise<boolean> {
  const admin = createAdminClient();

  const { data: ok } = await admin.rpc("consume_account_deletion_token", {
    p_user_id: params.userId,
    p_token: params.token,
  });
  if (!ok) return false;

  // Deleting the auth user cascades through profiles → workspaces → data.
  const { error } = await admin.auth.admin.deleteUser(params.userId);
  if (error) {
    logger.error("account.deletion_failed", {
      user_id: params.userId,
      error_message: error.message,
    });
    throw Errors.internal("We couldn't delete your account. Please contact support.");
  }

  await admin.from("profiles").delete().eq("id", params.userId);

  logger.info("account.deleted", { user_id: params.userId });
  return true;
}
