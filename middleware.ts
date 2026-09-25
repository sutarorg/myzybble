import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { supabaseConfigProblem } from "@/lib/env-public";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/find-leads",
  "/leads",
  "/lists",
  "/searches",
  "/campaigns",
  "/automations",
  "/mailboxes",
  "/settings",
  "/billing",
  "/ai",
];

/** Routes an authenticated user should not see (auth screens). */
const AUTH_ROUTES = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

/** Always public. */
const PUBLIC_PREFIXES = ["/api/health", "/api/webhooks", "/api/cron", "/_next", "/favicon", "/icon.svg"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Reported once per instance rather than per request: a misconfigured project
 * URL used to reach `createServerClient()` and fail with `TypeError: Invalid
 * URL` on every single request, which is a hard failure to read in the logs.
 */
let reportedConfigProblem = false;

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // If Supabase isn't configured — or is configured with a value that cannot
  // work, e.g. an API key where the project URL belongs — let the marketing site
  // render normally and let protected pages surface a clear configuration error.
  const configProblem = supabaseConfigProblem();
  if (configProblem) {
    if (!reportedConfigProblem) {
      reportedConfigProblem = true;
      console.warn(`[env] ${configProblem} Signed-in areas are disabled until it is fixed.`);
    }
    if (isProtected(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.search = "";
      url.searchParams.set("error", "not_configured");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  const { supabaseResponse, user } = await updateSession(request);

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match everything except Next internals and static assets so that session
     * refresh happens on all navigations (including RSC payload requests).
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)",
  ],
};
