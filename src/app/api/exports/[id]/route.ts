import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getExport, createDownloadUrl, processExport } from "@/server/services/exports";

/** GET /api/exports/[id] — status of an export job. */
export const GET = withRoute("GET /api/exports/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const id = ctx.params.id;

  const job = await getExport(auth.workspaceId, id);
  if (!job) return json({ error: { code: "not_found", message: "Export not found." } }, 404);

  // Small exports are generated on demand so the user isn't waiting on cron.
  if (job.status === "queued") {
    try {
      await processExport(id);
      const ready = await getExport(auth.workspaceId, id);
      if (ready?.status === "ready") {
        return json({ export: ready, downloadUrl: await createDownloadUrl(ready) });
      }
    } catch {
      // Fall through and report the persisted failure state.
    }
  }

  const refreshed = await getExport(auth.workspaceId, id);
  return json({
    export: refreshed,
    downloadUrl: refreshed?.status === "ready" ? await createDownloadUrl(refreshed) : null,
  });
});
