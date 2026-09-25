import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { createExportJob, getExport, processExport, createDownloadUrl } from "@/server/services/exports";
import { defaultColumns } from "@/lib/csv";
import { recordAudit } from "@/server/services/audit";

/**
 * GET /api/exports/download — one-shot CSV download.
 *
 * Small result sets are generated and streamed immediately. Anything larger is
 * turned into an export job (generated out-of-band) and the caller gets a 202
 * with the job id, so a big export never sits inside the request lifecycle
 * (§38).
 */
const INLINE_ROW_LIMIT = 5_000;

export const GET = withRoute("GET /api/exports/download", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("leads:export", auth.user.id, ctx);

  const params = new URL(request.url).searchParams;
  const scope = (params.get("scope") ?? "all") as "selected" | "filtered" | "list" | "search" | "all";
  const leadIds = params.get("leadIds")?.split(",").filter(Boolean);
  const listId = params.get("listId") ?? undefined;
  const searchId = params.get("searchId") ?? undefined;
  const columns = params.get("columns")?.split(",").filter(Boolean) ?? defaultColumns();

  // Pass through the lead list filters verbatim, so an export always matches
  // exactly what the user was looking at.
  const passthrough = new URLSearchParams();
  for (const key of ["q", "city", "state", "country", "category", "emailStatus", "minRating", "minReviewCount", "minScore", "sort", "direction"]) {
    const value = params.get(key);
    if (value) passthrough.set(key, value);
  }
  for (const key of ["hasEmail", "hasPhone", "hasWebsite", "contacted"]) {
    const value = params.get(key);
    if (value) passthrough.set(key, value);
  }
  const filters = Object.fromEntries(passthrough.entries());

  const job = await createExportJob({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    scope,
    columns,
    leadIds,
    listId,
    searchId,
    filters,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "export",
    entityType: "export",
    entityId: job.id,
    requestId: ctx.requestId,
    request,
    metadata: { scope, rows: leadIds?.length ?? null },
  });

  // "selected" with a bounded id list is always safe to generate inline.
  if (scope === "selected" && (leadIds?.length ?? 0) <= INLINE_ROW_LIMIT) {
    await processExport(job.id);
    const ready = await getExport(auth.workspaceId, job.id);
    if (ready?.status === "ready") {
      return json({ export: ready, downloadUrl: await createDownloadUrl(ready) });
    }
  }

  return json(
    {
      export: job,
      downloadUrl: null,
      message: "Export queued. It will be generated out-of-band; poll /api/exports/[id].",
    },
    202,
  );
});
