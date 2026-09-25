import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { EntitlementRow, PlanRow, UsageRow } from "@/types/database";

/**
 * Usage & entitlement service (§10).
 *
 * The server (and the worker) are the only sources of truth for quota. The
 * browser may display entitlement data but never decides it.
 */

export interface QuotaSnapshot {
  planCode: string;
  planName: string;
  monthlyLeads: number;
  leadsUsed: number;
  leadsRemaining: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  hasEmailData: boolean;
  hasPhoneData: boolean;
  hasCsvExport: boolean;
  hasAiAssistant: boolean;
  hasCampaigns: boolean;
}

export async function getEntitlements(workspaceId: string): Promise<QuotaSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entitlements")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    // Entitlements are created on signup; a missing row means first access.
    const created = await recomputeEntitlements(workspaceId);
    if (created) return toSnapshot(created);
    throw Errors.internal("Could not determine your plan's limits.");
  }

  return toSnapshot(data as EntitlementRow);
}

function toSnapshot(row: EntitlementRow): QuotaSnapshot {
  return {
    planCode: row.plan_code,
    planName: row.plan_name,
    monthlyLeads: row.monthly_leads,
    leadsUsed: Number(row.leads_used),
    leadsRemaining: Number(row.leads_remaining),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    hasEmailData: row.has_email_data,
    hasPhoneData: row.has_phone_data,
    hasCsvExport: row.has_csv_export,
    hasAiAssistant: row.has_ai_assistant,
    hasCampaigns: row.has_campaigns,
  };
}

/**
 * Recomputes entitlements from the subscription + usage tables.
 * Called after every billing state change and lazily when a row is missing.
 */
export async function recomputeEntitlements(workspaceId: string): Promise<EntitlementRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("recompute_entitlements", { p_workspace: workspaceId });
  if (error) {
    logger.error("entitlements.recompute_failed", {
      workspace_id: workspaceId,
      event: "entitlements.recompute",
      status: "error",
      error_code: error.code,
    });
    return null;
  }
  return (data?.[0] as EntitlementRow | undefined) ?? null;
}

/**
 * Reserves capacity before an expensive operation (a new search).
 *
 * We do not pre-charge: we check that there is headroom, because the exact
 * number of unique leads is unknown until the worker finishes. Billing stays
 * based on leads actually persisted.
 */
export async function assertCapacity(workspaceId: string, requested: number): Promise<QuotaSnapshot> {
  const snapshot = await getEntitlements(workspaceId);

  if (snapshot.status === "cancelled" || snapshot.status === "expired") {
    throw Errors.quotaExceeded("Your subscription is no longer active. Update billing to continue.");
  }
  if (snapshot.status === "paused") {
    throw Errors.quotaExceeded("Your subscription is paused. Resume billing to continue.");
  }
  if (snapshot.leadsRemaining <= 0) {
    throw Errors.quotaExceeded(
      `You've used all ${snapshot.monthlyLeads.toLocaleString()} leads included this month.`,
    );
  }

  // Cap the request at what's left rather than rejecting outright.
  if (requested > snapshot.leadsRemaining) {
    logger.info("usage.request_capped", {
      workspace_id: workspaceId,
      event: "usage.request_capped",
      status: "capped",
      metadata: { requested, remaining: snapshot.leadsRemaining },
    });
  }

  return snapshot;
}

/** Records a metered event idempotently. */
export async function recordUsage(params: {
  workspaceId: string;
  metric: "leads" | "searches" | "exports" | "ai_requests" | "emails_sent";
  delta: number;
  idempotencyKey: string;
  userId?: string;
  leadId?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ counted: boolean; leadsUsed: number; leadsLimit: number; leadsRemaining: number } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_usage", {
    p_workspace: params.workspaceId,
    p_metric: params.metric,
    p_delta: params.delta,
    p_idempotency_key: params.idempotencyKey,
    p_user_id: params.userId ?? null,
    p_lead_id: params.leadId ?? null,
    p_job_id: params.jobId ?? null,
    p_metadata: (params.metadata ?? {}) as never,
  });

  if (error) {
    logger.error("usage.record_failed", {
      workspace_id: params.workspaceId,
      event: "usage.record",
      status: "error",
      error_code: error.code,
    });
    return null;
  }

  const row = data?.[0];
  if (!row) return null;
  return {
    counted: row.counted,
    leadsUsed: Number(row.leads_used),
    leadsLimit: Number(row.leads_limit),
    leadsRemaining: Number(row.leads_remaining),
  };
}

export async function getUsageHistory(workspaceId: string, months = 6): Promise<UsageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usage")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("period_start", { ascending: false })
    .limit(months);
  return (data as UsageRow[] | null) ?? [];
}

/**
 * Emits a notification when usage crosses 80% or 100% (§26). Deduplicated by
 * period + threshold so a user is told once, not once per lead.
 */
export async function checkUsageThresholds(workspaceId: string, snapshot: QuotaSnapshot): Promise<void> {
  if (snapshot.monthlyLeads <= 0) return;
  const ratio = snapshot.leadsUsed / snapshot.monthlyLeads;
  const thresholds = [0.8, 1];
  for (const threshold of thresholds) {
    if (ratio >= threshold) {
      const { createNotification } = await import("@/server/services/notifications");
      await createNotification({
        workspaceId,
        type: "usage_threshold",
        title: threshold >= 1 ? "Monthly lead limit reached" : "You've used 80% of this month's leads",
        body:
          threshold >= 1
            ? `You've used all ${snapshot.monthlyLeads.toLocaleString()} leads on the ${snapshot.planName} plan.`
            : `${snapshot.leadsUsed.toLocaleString()} of ${snapshot.monthlyLeads.toLocaleString()} leads used this period.`,
        href: "/billing",
        severity: threshold >= 1 ? "warning" : "info",
        dedupeKey: `usage:${snapshot.periodStart ?? "current"}:${threshold}`,
      });
    }
  }
}

export async function listPlans(): Promise<PlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data as PlanRow[] | null) ?? [];
}
