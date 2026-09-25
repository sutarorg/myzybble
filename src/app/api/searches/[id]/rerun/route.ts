import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { rerunSearch } from "@/server/services/searches";
import { recordAudit } from "@/server/services/audit";

/** POST /api/searches/[id]/rerun — repeats a historical search (§18). */
export const POST = withRoute("POST /api/searches/[id]/rerun", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("search:create", auth.user.id, ctx);

  const result = await rerunSearch({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    searchId: ctx.params.id,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "create",
    entityType: "scrape_job",
    entityId: result.job.id,
    requestId: ctx.requestId,
    request,
    metadata: { rerunOf: ctx.params.id },
  });

  return json({ search: result.search, job: result.job }, 201);
});
