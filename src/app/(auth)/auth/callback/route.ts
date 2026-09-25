import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Supabase auth callback.
 *
 * Handles both link formats Supabase emits:
 *  - `?code=…`            — PKCE flow, exchanged with `exchangeCodeForSession`.
 *  - `?token_hash=…&type=…` — email templates using `{{ .TokenHash }}`,
 *    verified with `verifyOtp`.
 *
 * Both land here before any authenticated page so the session cookie is written
 * by the server (never by the browser).
 */

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  // `error_description` is surfaced verbatim by Supabase — echo it back on our
  // own error page rather than leaking a provider-branded URL.
  const providerError = url.searchParams.get("error_description");
  if (providerError) {
    logger.warn("auth.callback_provider_error", { error_message: providerError });
    return NextResponse.redirect(
      new URL(`/auth/error?reason=${encodeURIComponent(providerError)}`, url.origin),
    );
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn("auth.callback_exchange_failed", { error_message: error.message });
      return NextResponse.redirect(
        new URL(`/auth/error?reason=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // Narrowed to the types we actually send links for.
      type: type as "email" | "recovery" | "invite" | "magiclink" | "email_change" | "signup",
    });
    if (error) {
      logger.warn("auth.callback_verify_failed", { error_message: error.message, type });
      return NextResponse.redirect(
        new URL(`/auth/error?reason=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    // A recovery link must land on the password form, not the dashboard.
    return NextResponse.redirect(
      new URL(type === "recovery" ? "/auth/reset" : next, url.origin),
    );
  }

  return NextResponse.redirect(new URL("/auth/error?reason=Missing%20verification%20code", url.origin));
}
