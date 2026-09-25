/**
 * Central, validated access to environment variables.
 *
 * Rules enforced here:
 *  - Server-only secrets are read through `serverEnv` and the module is marked
 *    `server-only`, so importing it from a Client Component is a build error.
 *  - Public values are read through `publicEnv` (only NEXT_PUBLIC_* values).
 *  - Nothing here is ever serialised into a Client Component payload.
 *  - A value the deployment cannot use never takes the deployment down. It is
 *    reported with the variable name and the fix, and that one variable is
 *    treated as unset, which switches off the capability that needs it (see
 *    `capabilities` and `/settings/integrations`). Configuring eleven of twelve
 *    integrations correctly must not fail `next build` — nor 500 every route,
 *    including webhooks, over a typo in an optional one.
 *
 * Set `STRICT_ENV_VALIDATION=true` (staging, CI, a pre-launch check) to restore
 * hard failure on any unusable value.
 */
import "server-only";
import { z } from "zod";
import {
  diagnoseSupabaseAnonKey,
  diagnoseSupabaseServiceKey,
  diagnoseSupabaseUrl,
  looksLikeApiKey,
  normalizeEnvValue,
  toAbsoluteUrl,
} from "@/lib/env-normalize";

/**
 * A URL value, normalised on the way in: a bare `host` (what dashboards show
 * you) becomes `https://host`, quotes and whitespace are stripped by
 * `normalizeEnvValue` before validation, and a trailing slash is removed so
 * `WORKER_BASE_URL + "/health"` can never produce a double slash.
 *
 * `diagnose` recognises a value that is valid *as a URL* but is not the URL
 * this variable wants — an API key pasted into the project-URL slot, for
 * instance — and says what it actually is. `detail` explains the shape the
 * variable expects when it is not a URL at all.
 */
function urlValue(options: { diagnose?: (value: string) => string | null; detail?: string } = {}) {
  const suffix = options.detail ? ` — ${options.detail}` : "";
  return z
    .string()
    .superRefine((value, ctx) => {
      const problem = options.diagnose?.(value) ?? null;
      if (problem) ctx.addIssue({ code: "custom", message: problem });
      else if (looksLikeApiKey(value)) ctx.addIssue({ code: "custom", message: "looks like an API key, not a URL" });
      else if (!toAbsoluteUrl(value)) ctx.addIssue({ code: "custom", message: `is not a usable URL${suffix}` });
    })
    .transform((value) => toAbsoluteUrl(value) ?? value);
}

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: urlValue({
    diagnose: diagnoseSupabaseUrl,
    detail: "expected https://<project-ref>.supabase.co (docs/deployment.md §8.2)",
  }).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .superRefine((value, ctx) => {
      const problem = diagnoseSupabaseServiceKey(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    })
    .optional(),
  SUPABASE_DB_URL: z.string().optional(),
  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().default("zybble <no-reply@updates.zybble.app>"),
  EMAIL_REPLY_TO: z.string().optional(),
  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  // Worker / internal
  WORKER_ID: z.string().optional(),
  /** Base URL of the Railway worker (used for status and health polling). */
  WORKER_BASE_URL: urlValue({
    detail: "expected the worker's public domain, e.g. https://your-worker.up.railway.app (docs/deployment.md §8.6)",
  }).optional(),
  /** Shared secret the worker presents on internal endpoints. */
  WORKER_SHARED_SECRET: z.string().optional(),
  // Email provider config
  RESEND_VERIFIED_DOMAINS: z.string().optional(),
  /**
   * Key used to encrypt SMTP mailbox credentials at rest (AES-256-GCM).
   * Must be at least 32 characters when set.
   */
  MAILBOX_ENCRYPTION_KEY: z.string().optional(),
  // App
  NEXT_PUBLIC_SITE_URL: urlValue({
    detail: "expected your canonical origin, e.g. https://your-domain (docs/deployment.md §8.1)",
  }).optional(),
  CRON_SECRET: z.string().optional(),
  /** Turn unusable values into a hard failure. See the module docblock. */
  STRICT_ENV_VALIDATION: z
    .string()
    .optional()
    .transform((value) => value?.toLowerCase() === "true"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export interface EnvParseResult {
  env: ServerEnv;
  /** Values that were dropped, with the reason. Each is treated as unset. */
  problems: string[];
  /** Values that were kept, but will not work as the deployment intends. */
  warnings: string[];
}

/** What the schema produces when nothing usable is configured at all. */
const EMPTY_ENV: ServerEnv = serverSchema.parse({});

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Configurations that validate but cannot work, reported without dropping the
 * value — the variable is set, so the capability stays on and the operator gets
 * a specific explanation instead of a mystery.
 */
function collectEnvWarnings(env: ServerEnv): string[] {
  const warnings: string[] = [];

  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const problem = diagnoseSupabaseAnonKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    if (problem) warnings.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY ${problem}`);
  }

  if (env.WORKER_BASE_URL) {
    const host = hostnameOf(env.WORKER_BASE_URL);
    if (host.endsWith(".railway.internal")) {
      warnings.push(
        `WORKER_BASE_URL points at ${host}, which only resolves inside Railway's private network — ` +
          "the web app runs on Vercel and cannot reach it; use the service's public domain " +
          "(Settings → Networking → Generate Domain, docs/deployment.md §8.6)",
      );
    }
  }

  return warnings;
}

/**
 * Validate the process environment without ever throwing.
 *
 * Values that cannot be used are removed one key at a time so the rest of the
 * configuration — and every schema default — survives; the caller decides
 * whether to warn or fail. Exported for tests.
 */
export function parseServerEnv(raw: Record<string, string | undefined> = process.env): EnvParseResult {
  // Blank values and stray quotes arrive here from dashboards constantly; both
  // are formatting, not configuration.
  const supplied: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeEnvValue(value);
    if (normalized !== undefined) supplied[key] = normalized;
  }

  const parsed = serverSchema.safeParse(supplied);
  const problems: string[] = [];

  if (!parsed.success) {
    const seen = new Set<string>();
    for (const issue of parsed.error.issues) {
      const key = typeof issue.path[0] === "string" ? issue.path[0] : "";
      if (!key || seen.has(key) || !(key in supplied)) continue;
      seen.add(key);
      problems.push(`${key} ${issue.message}`);
      delete supplied[key];
    }
  }

  const lenient = parsed.success ? parsed : serverSchema.safeParse(supplied);
  const env = lenient.success ? lenient.data : EMPTY_ENV;

  return { env, problems, warnings: collectEnvWarnings(env) };
}

/**
 * Report what `parseServerEnv` found: a warning by default, an error when
 * `STRICT_ENV_VALIDATION=true`. Exported for tests.
 */
export function reportEnvProblems(
  problems: string[],
  warnings: string[] = [],
  options: { strict?: boolean; log?: (message: string) => void } = {},
): void {
  if (warnings.length > 0) {
    const log = options.log ?? ((message: string) => console.warn(message));
    log(
      `[env] Check the server environment configuration: ${warnings.join("; ")}. ` +
        "Every other variable is in use; the affected integration will not work until this is fixed.",
    );
  }

  if (problems.length === 0) return;

  const message =
    `[env] Ignoring unusable server environment values: ${problems.join("; ")}. ` +
    "The affected integrations are disabled, which /api/settings/integrations reports as not configured. " +
    "Fix the values in the dashboard and redeploy — see docs/deployment.md §8 for where each one comes from.";

  if (options.strict) throw new Error(message);
  (options.log ?? ((m: string) => console.warn(m)))(message);
}

const { env, problems, warnings } = parseServerEnv(process.env);
reportEnvProblems(problems, warnings, { strict: env.STRICT_ENV_VALIDATION });

export const serverEnv = env;

/**
 * Re-exported from the client-safe module so Server Components keep importing
 * everything from one place. Client Components import `@/lib/env-public`
 * directly — this module is `server-only` and holds the secrets.
 */
export { publicEnv, siteUrl, supabaseConfigProblem } from "@/lib/env-public";

/** True when a capability has all of the configuration it needs to run for real. */
export const capabilities = {
  supabase: Boolean(serverEnv.NEXT_PUBLIC_SUPABASE_URL && serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseAdmin: Boolean(serverEnv.NEXT_PUBLIC_SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY),
  razorpay: Boolean(serverEnv.RAZORPAY_KEY_ID && serverEnv.RAZORPAY_KEY_SECRET),
  resend: Boolean(serverEnv.RESEND_API_KEY),
  gemini: Boolean(serverEnv.GEMINI_API_KEY),
  worker: Boolean(serverEnv.WORKER_BASE_URL && serverEnv.WORKER_SHARED_SECRET),
} as const;

export type Capabilities = typeof capabilities;

/**
 * Guard used by API routes so that, when a provider is not configured, we return
 * a clear 503 rather than pretending the operation succeeded.
 */
export function requireCapability<K extends keyof Capabilities>(capability: K): void {
  if (!capabilities[capability]) {
    throw new Error(
      `The "${capability}" integration is not configured on this deployment. ` +
        `Set the required environment variables (see .env.example) and redeploy.`,
    );
  }
}
