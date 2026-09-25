/**
 * Public (`NEXT_PUBLIC_*`) configuration.
 *
 * Client-safe on purpose: Client Components, `middleware.ts` (edge runtime) and
 * Server Components all read the *same normalised* values, so a value that works
 * in one place works everywhere, and nobody has to remember to trim quotes or
 * add a scheme. It has no `server-only` guard and no Node-only imports —
 * `src/lib/env.ts` is the server-side counterpart and re-exports this object.
 *
 * These values are validated rather than dropped: Next.js inlines them into the
 * browser bundle at build time, so a broken one cannot be hidden from the
 * browser. The useful thing is to fail with a sentence that names the variable
 * and the fix — `new URL(undefined)` from inside `@supabase/ssr` is not.
 */
import {
  diagnoseSupabaseAnonKey,
  diagnoseSupabaseUrl,
  normalizeEnvValue,
  toAbsoluteUrl,
} from "@/lib/env-normalize";

const supabaseUrlRaw = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKeyRaw = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Canonical origin, normalised — `""` when it is unset or unusable. Callers that
 * need a fallback supply their own (local dev links default to localhost, the
 * marketing metadata to the public site).
 */
export const siteUrl = toAbsoluteUrl(normalizeEnvValue(process.env.NEXT_PUBLIC_SITE_URL) ?? "") ?? "";

/** Values that are safe to expose to the browser (already NEXT_PUBLIC_*). */
export const publicEnv = {
  /** Supabase project URL: `https://<project-ref>.supabase.co`. */
  supabaseUrl: toAbsoluteUrl(supabaseUrlRaw ?? "") ?? "",
  /** Anon/publishable key. Never the service-role key (see below). */
  supabaseAnonKey: supabaseAnonKeyRaw ?? "",
  /** Canonical origin, used for auth redirects, email links and canonical URLs. */
  siteUrl: siteUrl || "http://localhost:3000",
  /** Dev-only affordance: enables clearly-labelled simulated job data. */
  devMode: process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_MODE === "true",
} as const;

/**
 * Why the browser-side Supabase configuration cannot be used, as a complete
 * sentence, or `null` when it is fine.
 *
 * A missing or wrong value here is a deployment mistake, not a code path to
 * recover from: the browser cannot reach the project without it. Every Supabase
 * client factory therefore throws this message instead of letting a client
 * library discover the problem for itself.
 */
export function supabaseConfigProblem(): string | null {
  if (!supabaseUrlRaw) {
    return "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL is not set on this deployment (docs/deployment.md §8.2).";
  }
  const urlProblem = diagnoseSupabaseUrl(supabaseUrlRaw);
  if (urlProblem) {
    return `Supabase is misconfigured: NEXT_PUBLIC_SUPABASE_URL ${urlProblem}.`;
  }

  if (!supabaseAnonKeyRaw) {
    return "Supabase is not configured: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set on this deployment (docs/deployment.md §8.2).";
  }
  const keyProblem = diagnoseSupabaseAnonKey(supabaseAnonKeyRaw);
  if (keyProblem) {
    return `Supabase is misconfigured: NEXT_PUBLIC_SUPABASE_ANON_KEY ${keyProblem}.`;
  }

  return null;
}
