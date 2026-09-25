"use client";

import Link from "@/components/marketing/LinkCompat";
import { Logo, EASE } from "@/components/marketing/ui";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * Renders Supabase's failure reason verbatim (it's user-actionable — "link
 * expired", "email already confirmed") but never a stack trace or token.
 */
export default function AuthError({ reason }: { reason?: string }) {
  const message = reason?.slice(0, 300) || "We couldn't complete that sign-in link.";

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="px-5 py-5 sm:px-10">
        <Link to="/" aria-label="zybble home">
          <Logo />
        </Link>
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/40">Auth error</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em]">
            That link didn&apos;t work
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/60">{message}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/auth/login"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
            >
              Back to sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/auth/forgot-password"
              className="inline-flex items-center rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold text-ink"
            >
              Send a new link
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
