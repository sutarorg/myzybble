"use client";

import { useEffect } from "react";
import Link from "@/components/marketing/LinkCompat";
import { Logo, EASE } from "@/components/marketing/ui";
import { motion } from "framer-motion";

/**
 * Route-level error boundary. Shows the digest (which correlates to the server
 * log) but never the raw error message, which can contain connection strings or
 * query fragments.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[zybble] route error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="px-5 py-5 sm:px-10">
        <Link to="/" aria-label="zybble home">
          <Logo />
        </Link>
      </div>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-24">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/40">
            Something went wrong
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
            That didn&apos;t load
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/60">
            We hit an unexpected error. Retrying usually fixes it — if it doesn&apos;t, send us the
            reference code below and we&apos;ll dig in.
          </p>
          {error.digest && (
            <p className="mt-4 inline-block rounded-lg bg-ink px-3 py-2 font-mono text-xs text-lime">
              ref: {error.digest}
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
            >
              Try again
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold text-ink"
            >
              Go to dashboard
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
