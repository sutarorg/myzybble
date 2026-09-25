import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { createExportJob, listExports } from "@/server/services/exports";
import { recordAudit } from "@/server/services/audit";
import { exportInputSchema } from "@/lib/validation";

/** POST /api/exports — create an export job (never generated in-request). */
export const POST = withRoute("POST /api/exports", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("leads:export", auth.user.id, ctx);

  const input = await readJson(request, exportInputSchema);

  const job = await createExportJob({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    scope: input.scope,
    columns: input.columns,
    leadIds: input.leadIds,
    listId: input.listId,
    searchId: input.searchId,
    filters: (input.filters ?? {}) as Record<string, unknown>,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "export",
    entityType: "export",
    entityId: job.id,
    requestId: ctx.requestId,
    request,
    metadata: { scope: input.scope, columns: input.columns.length },
  });

  return json({ export: job }, 202);
});

/** GET /api/exports — recent exports for this workspace. */
export const GET = withRoute("GET /api/exports", async (request, _ctx) => {
  const auth = await requireAuthContext();
  const limit = Math.min(50, Number(new URL(request.url).searchParams.get("limit") ?? 20));
  const exports = await listExports(auth.workspaceId, limit);
  return json({ exports });
});
