import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // If Supabase isn't configured yet, let the marketing site render normally and
  // let protected pages surface a clear configuration error.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
