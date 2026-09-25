import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { buildDedupeKey, fallbackDedupeKey } from "@/lib/normalization/dedupe";
import type { SearchInput } from "@/lib/validation";
import type { ScrapeJobRow, ScrapeJobStatus, SearchRow } from "@/types/database";
import { assertCapacity, recordUsage } from "@/server/services/usage";
import { createNotification } from "@/server/services/notifications";

/**
 * Search + scrape-job service (§6, §7, §10).
 *
 * Creating a search is server-authoritative: capacity is checked against the
 * database entitlement, the requested limit is capped to the remaining quota,
 * and the job row is what the Railway worker actually claims.
 */

export interface CreateSearchResult {
  search: SearchRow;
  job: ScrapeJobRow;
  cappedTo: number | null;
  remainingAfterCap: number;
}

export async function createSearch(params: {
  workspaceId: string;
  userId: string;
  input: SearchInput;
}): Promise<CreateSearchResult> {
  const { workspaceId, userId, input } = params;

  // 1. Server-side capacity gate (§10). Never trust a client-computed quota.
  const quota = await assertCapacity(workspaceId, input.requestedLimit);
  const effectiveLimit = Math.min(input.requestedLimit, Math.max(quota.leadsRemaining, 0));
  if (effectiveLimit <= 0) {
    throw Errors.quotaExceeded("You have no leads remaining this month.");
  }

  const supabase = await createClient();

  // 2. At most one non-terminal job per workspace — prevents quota bypass by
  //    launching many simultaneous jobs (§10). Enforced by DB unique index.
  const { data: active } = await supabase
    .from("scrape_jobs")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("status", ["queued", "starting", "running", "paused", "cancelling"])
    .limit(1);

  if (active && active.length > 0) {
    throw Errors.conflict(
      "You already have a search running. Wait for it to finish, or pause/cancel it first.",
    );
  }

  const name = input.name?.trim() || defaultSearchName(input);

  // 3. Persist the search record (history, §18)…
  const { data: search, error: searchError } = await supabase
    .from("searches")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      name,
      keywords: input.keywords,
      locations: input.locations,
      radius: input.radius ?? null,
      requested_limit: effectiveLimit,
      language: input.language,
      min_rating: input.minRating ?? null,
      min_review_count: input.minReviewCount ?? null,
      require_website: input.requireWebsite,
      require_phone: input.requirePhone,
      require_email: input.requireEmail,
      business_status: input.businessStatus,
      extra_options: input.extraOptions as never,
      status: "queued",
    })
    .select("*")
    .single();

  if (searchError || !search) {
    if (searchError?.code === "23505") {
      throw Errors.conflict("You already have a search running.");
    }
    logger.error("search.create_failed", {
      workspace_id: workspaceId,
      user_id: userId,
      event: "search.create",
      status: "error",
      error_code: searchError?.code,
    });
    throw Errors.internal("Could not create your search.");
  }

  // 4. …and the queue row the worker will claim.
  const { data: job, error: jobError } = await supabase
    .from("scrape_jobs")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      search_id: (search as SearchRow).id,
      status: "queued",
      keywords: input.keywords,
      locations: input.locations,
      radius: input.radius ?? null,
      requested_limit: effectiveLimit,
      language: input.language,
      min_rating: input.minRating ?? null,
      min_review_count: input.minReviewCount ?? null,
      require_website: input.requireWebsite,
      require_phone: input.requirePhone,
      require_email: input.requireEmail,
      business_status: input.businessStatus,
      extra_options: input.extraOptions as never,
    })
    .select("*")
    .single();

  if (jobError || !job) {
    // Roll the search back so history doesn't show a search that can't run.
    await supabase.from("searches").delete().eq("id", (search as SearchRow).id);
    logger.error("job.create_failed", {
      workspace_id: workspaceId,
      event: "job.create",
      status: "error",
      error_code: jobError?.code,
    });
    throw Errors.internal("Could not queue your search.");
  }

  // 5. Meter the search run itself (leads are billed individually on persist).
  await recordUsage({
    workspaceId,
    metric: "searches",
    delta: 1,
    idempotencyKey: `search:${(job as ScrapeJobRow).id}`,
    userId,
    jobId: (job as ScrapeJobRow).id,
  });

  return {
    search: search as SearchRow,
    job: job as ScrapeJobRow,
    cappedTo: effectiveLimit < input.requestedLimit ? effectiveLimit : null,
    remainingAfterCap: quota.leadsRemaining,
  };
}

function defaultSearchName(input: SearchInput): string {
  const keyword = input.keywords[0] ?? "Businesses";
  const location = input.locations[0] ?? "";
  return location ? `${keyword} in ${location}` : keyword;
}

/** User-initiated lifecycle transitions (§6). */
export async function controlJob(params: {
  workspaceId: string;
  userId: string;
  jobId: string;
  action: "pause" | "resume" | "cancel" | "retry";
}): Promise<ScrapeJobRow> {
  const { workspaceId, jobId, action } = params;
  const admin = createAdminClient();

  const { data: job, error } = await admin
    .from("scrape_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !job) throw Errors.notFound("That search doesn't exist.");
  const current = job as ScrapeJobRow;

  let status: ScrapeJobStatus;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  switch (action) {
    case "pause":
      if (!["queued", "starting", "running"].includes(current.status)) {
        throw Errors.conflict(`A ${current.status} job can't be paused.`);
      }
      // The worker observes the flag on its next control poll and stops cleanly.
      status = current.status === "queued" ? "paused" : current.status;
      patch.status = status;
      patch.pause_requested = current.status === "queued" ? false : true;
      break;
    case "resume":
      if (current.status !== "paused") throw Errors.conflict("Only a paused job can be resumed.");
      status = "queued";
      patch.status = status;
      patch.pause_requested = false;
      patch.worker_id = null;
      patch.claimed_at = null;
      patch.heartbeat_at = null;
      patch.lease_expires_at = null;
      break;
    case "cancel":
      if (["completed", "failed", "cancelled"].includes(current.status)) {
        throw Errors.conflict(`A ${current.status} job can't be cancelled.`);
      }
      status = current.status === "queued" ? "cancelled" : "cancelling";
      patch.status = status;
      patch.cancel_requested = current.status !== "queued";
      patch.cancelled_at = status === "cancelled" ? new Date().toISOString() : null;
      patch.completed_at = status === "cancelled" ? new Date().toISOString() : null;
      break;
    case "retry":
      if (current.status !== "failed" && current.status !== "cancelled") {
        throw Errors.conflict("Only failed or cancelled jobs can be retried.");
      }
      status = "queued";
      patch.status = status;
      patch.attempts = 0;
      patch.error_message = null;
      patch.last_error_code = null;
      patch.completed_at = null;
      patch.cancelled_at = null;
      patch.cancel_requested = false;
      patch.pause_requested = false;
      patch.started_at = null;
      break;
    default:
      throw Errors.validation("Unsupported action.");
  }

  const { data: updated, error: updateError } = await admin
    .from("scrape_jobs")
    .update(patch as never)
    .eq("id", jobId)
    .select("*")
    .single();

  if (updateError || !updated) throw Errors.internal("Could not update that search.");

  await admin.from("scrape_job_events").insert({
    job_id: jobId,
    workspace_id: workspaceId,
    event: `job.${action}_requested`,
    status: (updated as ScrapeJobRow).status,
    message: `User requested ${action}.`,
  });

  return updated as ScrapeJobRow;
}

/** Re-runs a historical search with the same parameters (§18). */
export async function rerunSearch(params: {
  workspaceId: string;
  userId: string;
  searchId: string;
}): Promise<CreateSearchResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("searches")
    .select("*")
    .eq("id", params.searchId)
    .eq("workspace_id", params.workspaceId)
    .maybeSingle();

  if (error || !data) throw Errors.notFound("That search doesn't exist.");
  const search = data as SearchRow;

  return createSearch({
    workspaceId: params.workspaceId,
    userId: params.userId,
    input: {
      keywords: search.keywords,
      locations: search.locations,
      radius: search.radius,
      requestedLimit: search.requested_limit,
      language: search.language ?? "en",
      minRating: search.min_rating,
      minReviewCount: search.min_review_count,
      requireWebsite: search.require_website,
      requirePhone: search.require_phone,
      requireEmail: search.require_email,
      businessStatus: (search.business_status as "all" | "open" | "closed") ?? "all",
      name: search.name,
      extraOptions: (search.extra_options as Record<string, unknown>) ?? {},
    },
  });
}

export async function listSearches(
  workspaceId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ searches: SearchRow[]; total: number | null }> {
  const supabase = await createClient();
  const { limit = 25, offset = 0 } = options;

  const { data, count } = await supabase
    .from("searches")
    .select("*", { count: "estimated" })
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { searches: (data as SearchRow[] | null) ?? [], total: count ?? null };
}

export async function getSearch(workspaceId: string, searchId: string): Promise<SearchRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("searches")
    .select("*")
    .eq("id", searchId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as SearchRow | null) ?? null;
}

export async function getJob(workspaceId: string, jobId: string): Promise<ScrapeJobRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as ScrapeJobRow | null) ?? null;
}

export async function listJobs(workspaceId: string, limit = 20): Promise<ScrapeJobRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as ScrapeJobRow[] | null) ?? [];
}

export async function listJobEvents(workspaceId: string, jobId: string, limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scrape_job_events")
    .select("*")
    .eq("job_id", jobId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Called by the worker (or by a reconciliation pass) once a job reaches a
 * terminal state so the user is told and automations fire (§24, §26).
 */
export async function onJobTerminal(job: ScrapeJobRow): Promise<void> {
  if (job.status === "completed") {
    await createNotification({
      workspaceId: job.workspace_id,
      userId: job.user_id,
      type: "search_completed",
      title: "Search finished",
      body: `${job.unique_results.toLocaleString()} new leads from ${job.keywords.join(", ")}${
        job.locations.length ? ` in ${job.locations.join(", ")}` : ""
      }.`,
      href: `/searches/${job.search_id ?? job.id}`,
      severity: "success",
      dedupeKey: `search_completed:${job.id}`,
    });
  } else if (job.status === "failed") {
    await createNotification({
      workspaceId: job.workspace_id,
      userId: job.user_id,
      type: "search_failed",
      title: "Search failed",
      body: job.error_message ?? "The scraping worker could not complete this search.",
      href: `/searches/${job.search_id ?? job.id}`,
      severity: "error",
      dedupeKey: `search_failed:${job.id}`,
    });
  }

  const { runAutomations } = await import("@/server/services/automations");
  await runAutomations({
    workspaceId: job.workspace_id,
    triggerType: "search_completed",
    idempotencyKey: `job:${job.id}`,
    subject: { jobId: job.id, searchId: job.search_id, uniqueResults: job.unique_results },
  });
}

/** Manual lead creation from the UI (source = manual). */
export function dedupeKeyForManual(input: {
  businessName: string;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}): string {
  return (
    buildDedupeKey({
      website: input.website,
      phone: input.phone,
      businessName: input.businessName,
      address: input.address,
      city: input.city,
    })?.key ?? fallbackDedupeKey({ businessName: input.businessName, city: input.city })
  );
}
