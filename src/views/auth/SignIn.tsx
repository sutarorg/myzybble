"use client";

/**
 * Sign-in form. Design is unchanged from the original landing page; the
 * submission is now real: it posts to the `signInAction` server action, which
 * validates, rate-limits and authenticates through Supabase Auth.
 */

import { useActionState, useState } from "react";
import Link from "@/components/marketing/LinkCompat";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Check, Mail, Loader2 } from "lucide-react";
import AuthShell, { Field, inputCls } from "@/components/marketing/AuthShell";
import { EASE } from "@/components/marketing/ui";
import { signInAction, type AuthState } from "@/features/auth/actions";

const INITIAL: AuthState = { ok: false };

export default function SignIn({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL);
  const [show, setShow] = useState(false);

  return (
    <AuthShell
      title="Sign in — zybble"
      meta="Sign in to zybble to keep generating verified Google Maps leads."
      heading="Welcome back"
      sub="Your pipeline missed you. Pick up right where you left off."
      foot={
        <p className="text-center text-sm text-ink/55">
          New to zybble?{" "}
          <Link
            to="/auth/signup"
            className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4"
          >
            Create a free account
          </Link>
        </p>
      }
    >
      <form action={formAction} noValidate>
        {state.message && !state.needsVerification && (
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

        {state.needsVerification && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            role="status"
            className="mb-5 rounded-xl border border-lime/60 bg-lime/15 px-4 py-3 text-sm text-ink"
          >
            <strong className="font-semibold">Confirm your email to continue.</strong>{" "}
            <Link to="/auth/forgot-password" className="underline decoration-2 underline-offset-2">
              Resend the verification link
            </Link>
            .
          </motion.div>
        )}

        <div className="space-y-5">
          <Field label="Work email" error={state.errors?.email}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink/35" />
              <input
                type="email"
                name="email"
                placeholder="you@company.com"
                className={`${inputCls} pl-11`}
                autoComplete="email"
                required
              />
            </div>
          </Field>
          <Field label="Password" error={state.errors?.password}>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                className={`${inputCls} pr-12`}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 transition-colors hover:text-ink"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-ink/60">
            <Check className="mr-1.5 inline h-3.5 w-3.5 text-lime" strokeWidth={3.5} />
            Sessions stay signed in
          </span>
          <Link
            to="/auth/forgot-password"
            className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>

        <input type="hidden" name="next" value={next ?? "/dashboard"} />

        <button
          type="submit"
          disabled={pending}
          className="group mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 font-semibold text-paper transition-all duration-300 hover:bg-ink-3 hover:shadow-[0_16px_44px_rgba(11,16,14,0.28)] disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
        <p className="mt-5 text-center font-mono text-[11px] text-ink/40">
          protected by SOC 2-grade encryption · sso available
        </p>
      </form>
    </AuthShell>
  );
}
