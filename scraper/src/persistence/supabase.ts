/**
 * Worker-side persistence.
 *
 * The worker is a trusted internal service: it uses the service-role key and
 * therefore bypasses RLS. Every call here is scoped to a job the worker has
 * atomically claimed, which is the worker's authorisation boundary.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import type { Database, ScrapeJobRow, ScrapeJobStatus } from "../../../src/types/database";

let client: SupabaseClient<Database> | null = null;

export function db(): SupabaseClient<Database> {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    throw new Error("Supabase is not configured for the worker.");
  }
  client = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-zybble-actor": `worker:${config.workerId}` } },
  });
  return client;
}

export type Job = ScrapeJobRow;

export async function claimJob(engineVersion: string): Promise<Job | null> {
  const { data, error } = await db().rpc("claim_scrape_job", {
    p_worker_id: config.workerId,
    p_lease_seconds: config.leaseSeconds,
    p_engine_version: engineVersion,
  });
  if (error) throw new Error(`claim_scrape_job failed: ${error.message}`);
  return (data?.[0] as Job | undefined) ?? null;
}

export async function heartbeat(jobId: string): Promise<boolean> {
  const { data, error } = await db().rpc("heartbeat_scrape_job", {
    p_job_id: jobId,
    p_worker_id: config.workerId,
    p_lease_seconds: config.leaseSeconds,
  });
  if (error) return false;
  return data === true;
}

export async function requeueOrphans(limit = 100): Promise<string[]> {
  const { data, error } = await db().rpc("requeue_orphaned_jobs", { p_limit: limit });
  if (error) throw new Error(`requeue_orphaned_jobs failed: ${error.message}`);
  return (data ?? []) as string[];
}

export interface CounterDelta {
  actual_results?: number;
  unique_results?: number;
  duplicates?: number;
  filtered?: number;
  websites_found?: number;
  phones_found?: number;
  emails_found?: number;
  verified_emails?: number;
  billable_leads?: number;
  errors?: number;
  error_message?: string;
  last_error_code?: string;
}

export async function bumpCounters(jobId: string, deltas: CounterDelta): Promise<Job | null> {
  const { data, error } = await db().rpc("increment_job_counters", {
    p_job_id: jobId,
    p_deltas: deltas as unknown as never,
  });
  if (error) return null;
  return (data?.[0] as Job | undefined) ?? null;
}

export async function completeJob(
  jobId: string,
  status: ScrapeJobStatus,
  error?: string,
  errorCode?: string,
): Promise<Job | null> {
  const { data, error: rpcError } = await db().rpc("complete_scrape_job", {
    p_job_id: jobId,
    p_status: status,
    p_error: error ?? null,
    p_error_code: errorCode ?? null,
  });
  if (rpcError) return null;
  return (data?.[0] as Job | undefined) ?? null;
}

export async function logJobEvent(
  jobId: string,
  workspaceId: string,
  event: string,
  detail: { status?: ScrapeJobStatus; message?: string; errorCode?: string; counters?: Record<string, unknown> } = {},
): Promise<void> {
  await db().from("scrape_job_events").insert({
    job_id: jobId,
    workspace_id: workspaceId,
    event,
    status: detail.status ?? null,
    message: detail.message ?? null,
    error_code: detail.errorCode ?? null,
    counters: (detail.counters ?? null) as never,
    worker_id: config.workerId,
  });
}

export async function workerHeartbeat(status: "online" | "draining" | "offline" = "online", stats: Record<string, unknown> = {}) {
  await db().rpc("worker_heartbeat", {
    p_worker_id: config.workerId,
    p_hostname: process.env.HOSTNAME ?? null,
    p_region: config.region,
    p_version: config.version,
    p_status: status,
    p_max_concurrency: 1,
    p_stats: stats as never,
  });
}

export interface PersistResult {
  outcome: "inserted" | "merged" | "duplicate";
  isNew: boolean;
  leadId: string | null;
  billable: boolean;
}

/**
 * Persists one normalised lead and records usage exactly once per new lead.
 *
 * Billable unit: a *new unique lead* for the workspace. Merges and duplicates
 * are counted on the job but never billed (§10).
 */
export async function persistLead(params: {
  workspaceId: string;
  userId: string;
  jobId: string;
  searchId: string | null;
  dedupeKey: string;
  payload: Record<string, unknown>;
  emails: { email: string; status: string; source: string; confidence: number }[];
  phones: { e164: string; raw: string; kind: string }[];
  isDevData: boolean;
}): Promise<PersistResult> {
  const supabase = db();

  const { data, error } = await supabase.rpc("upsert_lead", {
    p_workspace: params.workspaceId,
    p_dedupe_key: params.dedupeKey,
    p_payload: params.payload as never,
    p_emails: params.emails as never,
    p_phones: params.phones as never,
    p_job_id: params.jobId,
    p_search_id: params.searchId,
    p_is_dev: params.isDevData,
  });

  if (error) {
    return { outcome: "duplicate", isNew: false, leadId: null, billable: false };
  }

  const row = data?.[0];
  if (!row) return { outcome: "duplicate", isNew: false, leadId: null, billable: false };

  const isNew = Boolean(row.is_new);
  let billable = false;

  if (isNew && row.lead_id) {
    const { data: usageData } = await supabase.rpc("record_usage", {
      p_workspace: params.workspaceId,
      p_metric: "leads",
      p_delta: 1,
      // Idempotent on the lead itself: re-processing can never double-bill.
      p_idempotency_key: `lead:${row.lead_id}`,
      p_user_id: params.userId,
      p_lead_id: row.lead_id,
      p_job_id: params.jobId,
      p_metadata: { dedupe_key: params.dedupeKey, job_id: params.jobId },
    });
    billable = usageData?.[0]?.counted === true;
  }

  return {
    outcome: row.outcome as PersistResult["outcome"],
    isNew,
    leadId: row.lead_id,
    billable,
  };
}

/** Reads the live control flags (pause / cancel) for a running job. */
export async function readJobControl(jobId: string): Promise<{ cancelRequested: boolean; pauseRequested: boolean; status: ScrapeJobStatus } | null> {
  const { data } = await db()
    .from("scrape_jobs")
    .select("cancel_requested, pause_requested, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!data) return null;
  return {
    cancelRequested: Boolean(data.cancel_requested),
    pauseRequested: Boolean(data.pause_requested),
    status: data.status as ScrapeJobStatus,
  };
}

export async function setJobRunning(jobId: string): Promise<void> {
  await db()
    .from("scrape_jobs")
    .update({ status: "running", heartbeat_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("worker_id", config.workerId);
}

export async function setJobPaused(jobId: string): Promise<void> {
  await db()
    .from("scrape_jobs")
    .update({ status: "paused", pause_requested: false, heartbeat_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("worker_id", config.workerId);
}
