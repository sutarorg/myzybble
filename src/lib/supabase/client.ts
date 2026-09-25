"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicEnv, supabaseConfigProblem } from "@/lib/env-public";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser Supabase client.
 *
 * Runs with the anon key only — every query is subject to Row Level Security,
 * which is the authoritative access-control layer for user data.
 *
 * This module renders on the server too (every Client Component is prerendered),
 * so the configuration is checked here rather than assumed: a typo in
 * `NEXT_PUBLIC_SUPABASE_URL` surfaces as the sentence below — which names the
 * value that belongs there — instead of `TypeError: Invalid URL` from inside the
 * client library.
 */
export function createClient() {
  if (cached) return cached;

  const problem = supabaseConfigProblem();
  if (problem) throw new Error(problem);

  cached = createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // handled explicitly by /auth/callback
      },
    },
  );
  return cached;
}
