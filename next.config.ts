import type { NextConfig } from "next";
import {
  diagnoseSupabaseAnonKey,
  diagnoseSupabaseUrl,
  normalizeEnvValue,
  toAbsoluteUrl,
} from "./src/lib/env-normalize";

/**
 * Values handed to the browser bundle.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so unlike a server-only variable it
 * cannot be ignored at runtime: a value the browser cannot parse has to be
 * settled *here*, or the build (or every page) fails for reasons that are hard to
 * read. This is the same normalisation the runtime applies — quotes trimmed, a
 * bare host completed to `https://` — and the same format checks, with one
 * difference: a value that is unusable is replaced with an empty string, which
 * the app already handles as "not configured" (the marketing site renders, the
 * dashboard tells you which variable to set, `/api/health` reports the
 * capability as off). The build log names what was wrong and what to paste
 * instead. Server-only secrets are never listed here.
 */
function publicEnvironment(): Record<string, string> {
  const problems: string[] = [];
  const env: Record<string, string> = {};

  const rawSupabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (rawSupabaseUrl === undefined) {
    env.NEXT_PUBLIC_SUPABASE_URL = "";
  } else {
    const problem = diagnoseSupabaseUrl(rawSupabaseUrl);
    if (problem) problems.push(`NEXT_PUBLIC_SUPABASE_URL ${problem}`);
    // Empty on an unusable value: a Supabase client built from it could only
    // throw, and "not configured" is a state this app answers for properly.
    env.NEXT_PUBLIC_SUPABASE_URL = problem ? "" : toAbsoluteUrl(rawSupabaseUrl) ?? "";
  }

  const rawAnonKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (rawAnonKey !== undefined) {
    // Anything here is inlined into every visitor's bundle, so a service_role
    // key is a leak to rotate — reported, but not something a build can fix.
    const problem = diagnoseSupabaseAnonKey(rawAnonKey);
    if (problem) problems.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY ${problem}`);
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = rawAnonKey;
  }

  const rawSiteUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SITE_URL);
  const siteUrl = rawSiteUrl === undefined ? "" : toAbsoluteUrl(rawSiteUrl) ?? "";
  if (rawSiteUrl !== undefined && !siteUrl) {
    problems.push(
      "NEXT_PUBLIC_SITE_URL is not a usable URL — expected your canonical origin, e.g. https://your-domain (docs/deployment.md §8.1)",
    );
  }
  env.NEXT_PUBLIC_SITE_URL = siteUrl;

  if (problems.length > 0) {
    console.warn(
      `[env] ${problems.join("; ")}. ` +
        "The value is empty in the browser bundle, where the app treats it as not configured: the marketing " +
        "site serves, the dashboard reports which variable to set, and /api/health reports the capability as " +
        "off. Fix it under the hosting provider's environment variables and redeploy — docs/deployment.md §8.",
    );
  }

  return env;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Never expose server-only secrets to the client bundle.
  env: publicEnvironment(),
  serverExternalPackages: ["postgres", "razorpay", "@google/genai"],
  experimental: {
    // Server Actions bodies are bounded; protects against oversized payloads.
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://api.resend.com https://generativelanguage.googleapis.com",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Export downloads are one-shot; keep them out of caches/indexes.
        source: "/api/exports/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
