import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverEnv } from "@/lib/env";

let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Service-role client. **Bypasses Row Level Security.**
 *
 * It must never be imported from anything that can reach the browser, and it
 * must never be used to satisfy a request without an explicit authorisation
 * check performed first (see `src/server/auth.ts`). This module is guarded by
 * `server-only` so a Client Component import fails at build time.
 *
 * Used for: worker operations, webhook handling, exports, usage accounting and
 * other trusted server-side work where the caller's own RLS context is not the
 * right boundary.
 */
export function createAdminClient() {
  if (cached) return cached;

  if (!serverEnv.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. This operation requires server-side credentials.",
    );
  }

  cached = createSupabaseClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-zybble-actor": "service-role" } },
    },
  );

  return cached;
}
