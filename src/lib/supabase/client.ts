"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser Supabase client.
 *
 * Runs with the anon key only — every query is subject to Row Level Security,
 * which is the authoritative access-control layer for user data.
 */
export function createClient() {
  if (cached) return cached;
  cached = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
