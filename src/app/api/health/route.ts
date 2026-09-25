import { withRoute, json } from "@/server/api";
import { capabilities } from "@/lib/env";

/**
 * Liveness/readiness probe (`docs/operations.md` §3).
 *
 * Public by design — it is in the middleware's `PUBLIC_PREFIXES` and exists so
 * uptime checks and load balancers can answer "is this deployment healthy"
 * without a session. It therefore leaks nothing: no counts, no versions, no
 * errors, no provider detail. It reports:
 *
 *  - `status`: "ok" when the app can reach its database, "degraded" when it
 *    cannot (still 200, so a transient DB blip doesn't flap the instance out
 *    of rotation — the error paths are what 500 on);
 *  - `capabilities`: which integrations this deployment is configured for —
 *    the same map `/settings/integrations` renders for signed-in users.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute("GET /api/health", async () => {
  let databaseReachable = false;

  // Cheap, server-only reachability probe: a head select on a small table.
  // Any error (bad key, network, paused project) lands here as false rather
  // than as a thrown error, because health must answer, not crash.
  if (capabilities.supabaseAdmin) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { error } = await admin.from("plans").select("id").limit(1);
      databaseReachable = !error;
    } catch {
      databaseReachable = false;
    }
  }

  return json({
    status: databaseReachable ? "ok" : "degraded",
    databaseReachable,
    capabilities,
    checkedAt: new Date().toISOString(),
  });
});
