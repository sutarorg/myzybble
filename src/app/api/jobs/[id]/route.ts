import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getJob, listJobEvents } from "@/server/services/searches";

/**
 * GET /api/jobs/[id] — authoritative job state.
 *
 * Realtime pushes updates, but the database is the source of truth: the UI
 * re-reads this on mount, on reconnect and after any missed event (§15).
 */
export const GET = withRoute("GET /api/jobs/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const jobId = ctx.params.id;
  if (!jobId) throw new Error("Missing job id.");

  const [job, events] = await Promise.all([
    getJob(auth.workspaceId, jobId),
    listJobEvents(auth.workspaceId, jobId, 30),
  ]);

  if (!job) return json({ error: { code: "not_found", message: "Job not found." } }, 404);
  return json({ job, events });
});
