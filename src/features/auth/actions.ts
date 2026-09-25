"use server";

/**
 * Authentication server actions.
 *
 * Every action runs on the server only, is zod-validated, rate-limited and
 * returns a serialisable `AuthState` that the client form renders. Supabase is
 * the single source of truth for credentials — nothing here trusts a
 * client-supplied session, role or entitlement.
 *
 * The service-role key is never imported into this module (and never leaves the
 * server): all operations run through the cookie-bound user client.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/server/rate-limit";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { describeError } from "@/lib/logger";
import { sendWelcomeEmail } from "@/server/services/email";

export interface AuthState {
  ok: boolean;
  /** Field-level validation errors, keyed by input name. */
  errors?: Record<string, string>;
  /** A human-readable, non-leaking message for the whole form. */
  message?: string;
  /** Set when the user must verify their address before continuing. */
  needsVerification?: boolean;
}

const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address")
  .max(320, "That email address is too long")
  .email("Enter a valid email address")
  .transform((v) => v.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "That password is too long");

const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") });
const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1, "Enter your name").max(120, "That name is too long"),
  workspaceName: z.string().trim().max(120, "That name is too long").optional(),
  acceptTerms: z.literal(true, { message: "Please accept the Terms of Service" }),
});
const resetSchema = z.object({ email: emailSchema });
const newPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

/**
 * `next` is validated against a relative-path allowlist so a crafted form post
 * cannot turn the login endpoint into an open redirect.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  if (raw.startsWith("/auth/")) return "/dashboard";
  return raw;
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const limit = await enforceRateLimit("auth:login", await clientKey("login"));
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic: never reveal whether the address exists.
    logger.warn("auth.sign_in_failed", { reason: describeError(error) });
    const message =
      error.code === "email_not_confirmed"
        ? "Confirm your email address first — check your inbox for the verification link."
        : "Incorrect email or password.";
    return { ok: false, message, needsVerification: error.code === "email_not_confirmed" };
  }

  if (!data.user) return { ok: false, message: "Incorrect email or password." };

  logger.info("auth.sign_in", { userId: data.user.id });
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    workspaceName: formData.get("workspaceName") || undefined,
    acceptTerms: formData.get("acceptTerms") === "on" || formData.get("acceptTerms") === "true",
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const limit = await enforceRateLimit("auth:signup", await clientKey("signup"));
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many sign-up attempts. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
    };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin = publicEnv.siteUrl ?? h.get("origin") ?? "";

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: {
        full_name: parsed.data.fullName,
        workspace_name: parsed.data.workspaceName?.trim() || `${parsed.data.fullName}'s workspace`,
      },
    },
  });

  if (error) {
    logger.warn("auth.sign_up_failed", { reason: describeError(error) });
    const message =
      error.code === "user_already_exists" || error.status === 422
        ? "An account with that email already exists. Try signing in instead."
        : "We couldn't create your account. Please try again.";
    return { ok: false, message };
  }

  if (!data.user) return { ok: false, message: "We couldn't create your account. Please try again." };

  // `handle_new_user()` (migration 0002) creates the profile + workspace +
  // free subscription, so we only need the best-effort welcome email here.
  if (data.user.email_confirmed_at || !data.session) {
    await sendWelcomeEmail({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
    }).catch((err: unknown) => logger.warn("email.welcome_failed", { reason: describeError(err) }));
  }

  logger.info("auth.sign_up", { userId: data.user.id });

  // With email confirmation on, Supabase returns a user but no session: the UI
  // shows the "check your inbox" state. Otherwise we're already signed in.
  if (!data.session) return { ok: true, needsVerification: true };
  redirect(safeNext(formData.get("next")));
}

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const limit = await enforceRateLimit("auth:reset", await clientKey("reset"));
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many requests. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
    };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin = publicEnv.siteUrl ?? h.get("origin") ?? "";

  // Always report success: responding differently would let an attacker
  // enumerate which addresses have accounts.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset`,
  });
  if (error) logger.warn("auth.reset_failed", { reason: describeError(error) });

  return { ok: true, message: "If that address has an account, a reset link is on its way." };
}

export async function updatePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { ok: false, errors: { confirmPassword: "Passwords don't match" } };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, message: "That reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logger.warn("auth.password_update_failed", { reason: describeError(error) });
    return { ok: false, message: "We couldn't update your password. Please try again." };
  }

  logger.info("auth.password_updated", { userId: userData.user.id });
  redirect("/dashboard?welcome=password");
}

export async function resendVerificationAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const limit = await enforceRateLimit("auth:reset", await clientKey("resend"));
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many requests. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
    };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin = publicEnv.siteUrl ?? h.get("origin") ?? "";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (error) logger.warn("auth.resend_failed", { reason: describeError(error) });

  return { ok: true, message: "Verification email sent. Check your inbox (and spam)." };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
