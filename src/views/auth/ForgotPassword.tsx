"use client";

/**
 * Password-reset request. Rate-limited server-side and always responds with the
 * same message so it can't be used to enumerate accounts.
 */

import { useActionState } from "react";
import Link from "@/components/marketing/LinkCompat";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Loader2, Check } from "lucide-react";
import AuthShell, { Field, inputCls } from "@/components/marketing/AuthShell";
import { EASE } from "@/components/marketing/ui";
import {
  requestPasswordResetAction,
  resendVerificationAction,
  type AuthState,
} from "@/features/auth/actions";

const INITIAL: AuthState = { ok: false };

export default function ForgotPassword({ mode = "reset" }: { mode?: "reset" | "verify" }) {
  const action = mode === "verify" ? resendVerificationAction : requestPasswordResetAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const verify = mode === "verify";

  return (
    <AuthShell
      title={verify ? "Resend verification — zybble" : "Reset password — zybble"}
      meta={
        verify
          ? "Resend your zybble email verification link."
          : "Reset your zybble password. We'll email you a secure link."
      }
      heading={verify ? "Resend verification" : "Forgot your password?"}
      sub={
        verify
          ? "Enter your email and we'll send a fresh verification link."
          : "No worries. Enter your email and we'll send a link to choose a new one."
      }
      foot={
        <p className="text-center text-sm text-ink/55">
          Remembered it?{" "}
          <Link
            to="/auth/login"
            className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      {state.ok ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="rounded-2xl border border-ink/10 bg-white/70 p-8 text-center"
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime">
            <Check className="h-7 w-7 text-ink" strokeWidth={3} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">Check your inbox</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">{state.message}</p>
        </motion.div>
      ) : (
        <form action={formAction} noValidate>
          {state.message && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              role="alert"
              className="mb-5 rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-600"
            >
              {state.message}
            </motion.div>
          )}

          <Field label="Work email" error={state.errors?.email}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink/35" />
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@company.com"
                className={`${inputCls} pl-11`}
                required
              />
            </div>
          </Field>

          <button
            type="submit"
            disabled={pending}
            className="group mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 font-semibold text-paper transition-all duration-300 hover:bg-ink-3 hover:shadow-[0_16px_44px_rgba(11,16,14,0.28)] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <>
                {verify ? "Resend link" : "Send reset link"}
                <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
          <p className="mt-5 text-center font-mono text-[11px] text-ink/40">
            links expire in 1 hour · never shared
          </p>
        </form>
      )}
    </AuthShell>
  );
}
