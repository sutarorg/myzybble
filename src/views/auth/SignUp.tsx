"use client";

/**
 * Sign-up form. Visually identical to the original; submission now runs
 * `signUpAction`, which creates the Supabase user. Migration 0002's
 * `handle_new_user()` trigger provisions the profile, workspace and free
 * subscription in the same transaction, so the account is usable immediately.
 */

import { useActionState, useState } from "react";
import Link from "@/components/marketing/LinkCompat";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Loader2, Check } from "lucide-react";
import AuthShell, { Field, inputCls } from "@/components/marketing/AuthShell";
import { EASE } from "@/components/marketing/ui";
import { cn } from "@/lib/cn";
import { signUpAction, type AuthState } from "@/features/auth/actions";

const INITIAL: AuthState = { ok: false };

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ["too weak", "weak", "okay", "strong", "elite"];

export default function SignUp({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signUpAction, INITIAL);
  const [pw, setPw] = useState("");
  const [accepted, setAccepted] = useState(true);
  const s = strength(pw);

  // Supabase is configured with email confirmation, so a successful sign-up
  // returns a user but no session: we show the "check your inbox" state.
  if (state.ok && state.needsVerification) {
    return (
      <AuthShell
        title="Check your email — zybble"
        meta="Confirm your zybble account to unlock your 100 free leads."
        heading="Check your inbox"
        sub="We sent you a verification link — it expires in 24 hours."
        foot={
          <p className="text-center text-sm text-ink/55">
            Already verified?{" "}
            <Link
              to="/auth/login"
              className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="rounded-2xl border border-ink/10 bg-white/70 p-8 text-center"
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime">
            <Sparkles className="h-7 w-7 text-ink" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">Almost there</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">
            Click the verification link and your{" "}
            <span className="font-semibold text-ink">100 free leads</span> will be waiting inside —
            plus email data, phone data, CSV export, the AI Assistant and Campaigns.
          </p>
          <p className="mt-4 rounded-xl bg-ink px-4 py-3 font-mono text-xs text-lime">
            +100 lead credits · full platform unlocked
          </p>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account — zybble"
      meta="Start free with zybble: 100 verified Google Maps leads — email & phone data, CSV export, AI Assistant and Campaigns included."
      heading="Claim your 100 free leads"
      sub="Free forever · every feature included · no credit card."
      foot={
        <p className="text-center text-sm text-ink/55">
          Already have an account?{" "}
          <Link
            to="/auth/login"
            className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4"
          >
            Sign in
          </Link>
        </p>
      }
    >
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

        <div className="space-y-5">
          <Field label="Full name" error={state.errors?.fullName}>
            <input
              name="fullName"
              autoComplete="name"
              placeholder="Maya Chen"
              className={inputCls}
              required
            />
          </Field>
          <Field label="Work email" error={state.errors?.email}>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@company.com"
              className={inputCls}
              required
            />
          </Field>
          <Field label="Workspace (optional)" error={state.errors?.workspaceName}>
            <input
              name="workspaceName"
              autoComplete="organization"
              placeholder="BrightFunnel"
              className={inputCls}
            />
          </Field>
          <Field label="Password" error={state.errors?.password}>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputCls}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
            />
            <div className="mt-2.5 flex gap-1.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-300",
                    i < s
                      ? ["bg-red-400", "bg-amber-400", "bg-lime", "bg-lime"][s - 1] ?? "bg-lime"
                      : "bg-ink/10",
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/40">
              {pw.length > 0 ? STRENGTH_LABEL[s] : "min 8 characters"}
            </p>
          </Field>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-sm text-ink/60">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="peer sr-only"
          />
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink/20 bg-white transition-colors peer-checked:border-ink peer-checked:bg-ink [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
            <Check className="h-3 w-3 text-lime transition-opacity" strokeWidth={3.5} />
          </span>
          <span>
            I agree to the{" "}
            <Link to="/terms" className="text-ink underline decoration-lime decoration-2 underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-ink underline decoration-lime decoration-2 underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {state.errors?.acceptTerms && (
          <p className="mt-1.5 text-xs text-red-500">{state.errors.acceptTerms}</p>
        )}

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
              Create free account
              <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
        <p className="mt-5 text-center font-mono text-[11px] text-ink/40">
          no credit card · cancel anytime · 100 free leads
        </p>
      </form>
    </AuthShell>
  );
}
