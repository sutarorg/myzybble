import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicEnv, supabaseConfigProblem } from "@/lib/env-public";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers.
 *
 * It carries the user's cookies, so `getUser()` validates the session and every
 * query runs under RLS as that user. Cookie writes are best-effort: middleware
 * owns session refresh, and Server Components may not set cookies.
 */
export async function createClient() {
  // `cookies()` is called before anything else on purpose: it is what marks the
  // calling route as dynamic, and a session-scoped client is never prerenderable.
  const cookieStore = await cookies();

  const problem = supabaseConfigProblem();
  if (problem) throw new Error(problem);

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // Middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
