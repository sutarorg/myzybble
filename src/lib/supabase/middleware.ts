import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { publicEnv, supabaseConfigProblem } from "@/lib/env-public";

/**
 * Refreshes the Supabase session on every request and writes rotated cookies
 * back onto both the request (so downstream Server Components see the fresh
 * token) and the response (so the browser stores it).
 *
 * `getUser()` is used deliberately: it validates the JWT against the project
 * keys, whereas `getSession()` only reads the cookie.
 */
export async function updateSession(request: NextRequest) {
  const problem = supabaseConfigProblem();
  if (problem) throw new Error(problem);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshing here keeps sessions alive across navigations and Server Actions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
