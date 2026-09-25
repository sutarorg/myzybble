/**
 * Central, validated access to environment variables.
 *
 * Rules enforced here:
 *  - Server-only secrets are read through `serverEnv` and the module is marked
 *    `server-only`, so importing it from a Client Component is a build error.
 *  - Public values are read through `publicEnv` (only NEXT_PUBLIC_* values).
 *  - Nothing here is ever serialised into a Client Component payload.
 */
import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
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
  /** Browser-side base URL of the Railway worker (used for status polling). */
  WORKER_BASE_URL: z.string().url().optional(),
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
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message instead of undefined-secret bugs later.
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
  throw new Error(`Invalid server environment configuration: ${issues}`);
}

export const serverEnv = parsed.data;

/** Values that are safe to expose to the browser (already NEXT_PUBLIC_*). */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Dev-only affordance: enables clearly-labelled simulated job data. */
  devMode: process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_MODE === "true",
} as const;

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
