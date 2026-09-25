"use client";

/**
 * Choose a new password. Reached from the emailed link, which Supabase exchanges
 * for a session in `/auth/callback` before redirecting here — so `updateUser`
 * is authenticated at this point.
 */

import { useActionState, useState } from "react";
import Link from "@/components/marketing/LinkCompat";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import AuthShell, { Field, inputCls } from "@/components/marketing/AuthShell";
import { EASE } from "@/components/marketing/ui";
import { updatePasswordAction, type AuthState } from "@/features/auth/actions";

const INITIAL: AuthState = { ok: false };

export default function ResetPassword() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, INITIAL);
  const [show, setShow] = useState(false);

  return (
    <AuthShell
      title="Choose a new password — zybble"
      meta="Set a new zybble password."
      heading="Choose a new password"
      sub="Make it strong — at least 8 characters, ideally with a number and a symbol."
      foot={
        <p className="text-center text-sm text-ink/55">
          Link expired?{" "}
          <Link
            to="/auth/forgot-password"
            className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4"
          >
            Request a new one
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
          <Field label="New password" error={state.errors?.password}>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={`${inputCls} pr-12`}
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
          <Field label="Confirm password" error={state.errors?.confirmPassword}>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputCls}
              required
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="group mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 font-semibold text-paper transition-all duration-300 hover:bg-ink-3 hover:shadow-[0_16px_44px_rgba(11,16,14,0.28)] disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <>
              Update password
              <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
