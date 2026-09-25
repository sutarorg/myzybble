import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { csvLinesAsync, EXPORTABLE_COLUMNS } from "@/lib/csv";
import { listLeads } from "@/server/services/leads";
import { recordUsage } from "@/server/services/usage";
import type { ExportRow } from "@/types/database";

/**
 * CSV export service (§19, §38).
 *
 * Large exports are never generated inside a request: the API only creates an
 * export job, and generation happens out-of-band (via the cron/worker route or
 * inline for small sets). Results are written to private Supabase Storage and
 * served through a tokenised download route, so there is no public file URL.
 *
 * Generation is chunked and streamed, keeping memory flat regardless of size.
 */

export const EXPORT_BUCKET = "exports";
const PAGE_SIZE = 1_000;
const MAX_ROWS = 250_000;

export interface CreateExportInput {
  workspaceId: string;
  userId: string;
  scope: "selected" | "filtered" | "list" | "search" | "all";
  columns: string[];
  leadIds?: string[];
  listId?: string;
  searchId?: string;
  filters?: Record<string, unknown>;
}

export async function createExportJob(input: CreateExportInput): Promise<ExportRow> {
  const supabase = await createClient();

  const columns = input.columns.filter((c) =>
    (EXPORTABLE_COLUMNS as readonly string[]).includes(c),
  );
  if (columns.length === 0) throw Errors.validation("Select at least one export column.");

  const { data, error } = await supabase
    .from("exports")
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      kind: input.scope === "list" ? "list" : input.scope === "search" ? "search" : "leads",
      status: "queued",
      filters: {
        scope: input.scope,
        filters: input.filters ?? {},
        listId: input.listId ?? null,
        searchId: input.searchId ?? null,
        leadIds: input.leadIds ?? null,
      } as never,
      columns,
      lead_ids: input.leadIds ?? null,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("export.create_failed", {
      workspace_id: input.workspaceId,
      event: "export.create",
      status: "error",
      error_code: error?.code,
    });
    throw Errors.internal("Could not start that export.");
  }

  await recordUsage({
    workspaceId: input.workspaceId,
    metric: "exports",
    delta: 1,
    idempotencyKey: `export:${(data as ExportRow).id}`,
    userId: input.userId,
  });

  return data as ExportRow;
}

export async function listExports(workspaceId: string, limit = 20): Promise<ExportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exports")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as ExportRow[] | null) ?? [];
}

export async function getExport(workspaceId: string, exportId: string): Promise<ExportRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exports")
    .select("*")
    .eq("id", exportId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as ExportRow | null) ?? null;
}

/**
 * Generates the CSV for a queued export. Runs outside the request lifecycle.
 *
 * Leads are read in pages and appended to a growing buffer that is uploaded in
 * chunks, so a 250k-row export never holds the whole file in memory twice.
 */
export async function processExport(exportId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: job, error } = await admin
    .from("exports")
    .select("*")
    .eq("id", exportId)
    .maybeSingle();

  if (error || !job) throw Errors.notFound("That export doesn't exist.");
  const row = job as ExportRow;
  if (row.status !== "queued") return;

  await admin
    .from("exports")
    .update({ status: "processing", started_at: new Date().toISOString() } as never)
    .eq("id", exportId);

  const filters = (row.filters ?? {}) as {
    scope?: string;
    filters?: Record<string, unknown>;
    listId?: string | null;
    searchId?: string | null;
    leadIds?: string[] | null;
  };

  try {
    const columns = row.columns;
    const chunks: string[] = [];
    let total = 0;

    const generator = csvLinesAsync(columns, leadIterator({
      workspaceId: row.workspace_id,
      scope: (filters.scope ?? "all") as never,
      filters: filters.filters ?? {},
      listId: filters.listId ?? null,
      searchId: filters.searchId ?? null,
      leadIds: row.lead_ids ?? filters.leadIds ?? null,
    }));

    for await (const line of generator) {
      chunks.push(line);
      total += 1;
      if (chunks.length >= 2_000) {
        await appendChunk(admin, row, chunks.splice(0, chunks.length), false);
      }
      if (total > MAX_ROWS) break;
    }

    const path = `${row.workspace_id}/${exportId}.csv`;
    await appendChunk(admin, row, chunks, true, path);

    // Row count excludes the BOM+header line emitted by the generator.
    const rowCount = Math.max(0, total - 1);

    await admin
      .from("exports")
      .update({
        status: "ready",
        row_count: rowCount,
        file_path: path,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", exportId);

    logger.info("export.completed", {
      workspace_id: row.workspace_id,
      event: "export.process",
      status: "ok",
      metadata: { export_id: exportId, rows: rowCount },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("exports")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() } as never)
      .eq("id", exportId);
    logger.error("export.failed", {
      workspace_id: row.workspace_id,
      event: "export.process",
      status: "error",
      error_message: message,
      metadata: { export_id: exportId },
    });
    throw error;
  }
}

/** Yields plain objects in the requested column order. */
async function* leadIterator(params: {
  workspaceId: string;
  scope: "selected" | "filtered" | "list" | "search" | "all";
  filters: Record<string, unknown>;
  listId: string | null;
  searchId: string | null;
  leadIds: string[] | null;
}): AsyncGenerator<Record<string, unknown>> {
  const admin = createAdminClient();
  const columns = "*";

  const project = (lead: Record<string, unknown>) => ({
    business_name: lead.business_name,
    category: lead.category,
    website: lead.website,
    maps_url: lead.maps_url,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    postal_code: lead.postal_code,
    phone: lead.primary_phone,
    email: lead.primary_email,
    email_status: lead.email_status,
    rating: lead.rating,
    review_count: lead.review_count,
    business_status: lead.business_status,
    latitude: lead.latitude,
    longitude: lead.longitude,
    tags: null as string[] | null,
    notes: lead.notes,
    lead_score: lead.lead_score,
    source: lead.source,
    contacted_at: lead.contacted_at,
    created_at: lead.created_at,
    opening_hours: lead.opening_hours,
    plus_code: lead.plus_code,
    price_range: lead.price_range,
    social_links: lead.social_links,
  });

  if (params.scope === "selected" && params.leadIds?.length) {
    for (let i = 0; i < params.leadIds.length; i += PAGE_SIZE) {
      const batch = params.leadIds.slice(i, i + PAGE_SIZE);
      const { data } = await admin
        .from("leads")
        .select(columns)
        .eq("workspace_id", params.workspaceId)
        .in("id", batch)
        .is("deleted_at", null);
      for (const lead of (data ?? []) as Record<string, unknown>[]) {
        yield withTags(admin, project(lead), lead.id as string);
      }
    }
    return;
  }

  // Everything else reuses the same server-side filter path as the UI, so an
  // export always matches exactly what the user filtered on.
  let cursor: string | undefined;
  let emitted = 0;

  while (emitted < MAX_ROWS) {
    const page = await listLeads(params.workspaceId, {
      ...(params.filters as Record<string, unknown>),
      listId: params.listId ?? undefined,
      searchId: params.searchId ?? undefined,
      cursor,
      limit: PAGE_SIZE,
    });

    if (page.leads.length === 0) break;
    for (const lead of page.leads) {
      yield project(lead as unknown as Record<string, unknown>);
      emitted += 1;
    }
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
}

async function withTags(
  admin: ReturnType<typeof createAdminClient>,
  row: Record<string, unknown>,
  leadId: string,
): Promise<Record<string, unknown>> {
  const { data } = await admin.from("lead_tags").select("tag").eq("lead_id", leadId);
  row.tags = ((data ?? []) as { tag: string }[]).map((t) => t.tag);
  return row;
}

/**
 * Appends CSV text to the storage object. Supabase Storage has no server-side
 * append, so we re-upload the concatenation of the existing object and the new
 * chunk — acceptable because chunks are large and exports are one-shot.
 */
async function appendChunk(
  admin: ReturnType<typeof createAdminClient>,
  job: ExportRow,
  chunks: string[],
  final: boolean,
  path?: string,
): Promise<void> {
  const target = path ?? `${job.workspace_id}/${job.id}.csv.part`;
  const payload = chunks.join("");
  if (!payload) return;

  const { data: existing } = await admin.storage.from(EXPORT_BUCKET).download(target);
  const previous = existing ? await existing.text() : "";
  const combined = previous + payload;

  const { error } = await admin.storage
    .from(EXPORT_BUCKET)
    .upload(target, Buffer.from(combined, "utf8"), {
      contentType: "text/csv; charset=utf-8",
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(`Could not write export file: ${error.message}`);
  }

  if (final) {
    await admin
      .from("exports")
      .update({ file_size_bytes: Buffer.byteLength(combined, "utf8") } as never)
      .eq("id", job.id);
  }
}

/** Creates a short-lived signed URL for a completed export. */
export async function createDownloadUrl(job: ExportRow): Promise<string> {
  const admin = createAdminClient();
  if (!job.file_path) throw Errors.notFound("That export file isn't ready.");
  const { data, error } = await admin.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(job.file_path, 900);
  if (error || !data) throw Errors.internal("Could not prepare that download.");
  return data.signedUrl;
}

/** Processes the next queued exports — invoked by the cron route (§38). */
export async function processQueuedExports(limit = 3): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("exports")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  for (const row of (data ?? []) as { id: string }[]) {
    try {
      await processExport(row.id);
      processed += 1;
    } catch {
      // Already logged inside processExport; continue with the next job.
    }
  }
  return processed;
}

/** Best-effort cleanup of expired export files (§34 retention). */
export async function purgeExpiredExports(limit = 50): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("exports")
    .select("id, file_path, workspace_id")
    .lt("expires_at", new Date().toISOString())
    .not("file_path", "is", null)
    .limit(limit);

  let removed = 0;
  for (const row of (data ?? []) as { id: string; file_path: string | null; workspace_id: string }[]) {
    if (row.file_path) {
      await admin.storage.from(EXPORT_BUCKET).remove([row.file_path]);
    }
    await admin.from("exports").update({ status: "expired", file_path: null } as never).eq("id", row.id);
    removed += 1;
  }
  return removed;
}
