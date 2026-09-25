"use client";

import { motion } from "framer-motion";
import Link from "@/components/marketing/LinkCompat";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* Scroll-triggered reveal wrapper */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* Mono eyebrow tag with pulsing dot */
export function SectionTag({
  children,
  variant = "light",
  className,
}: {
  children: ReactNode;
  variant?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-medium tracking-[0.18em] uppercase",
        variant === "light"
          ? "border-ink/15 bg-ink/[0.04] text-ink/70"
          : "border-white/15 bg-white/[0.06] text-paper/80",
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-2 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime-2" />
      </span>
      {children}
    </span>
  );
}

/* Brand mark: "Z" as a route line ending in a destination node */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6.75 7.5h10.5L8.25 16.5H15"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.6" cy="16.5" r="2" fill="currentColor" />
    </svg>
  );
}

/* Brand logo — icon mark only */
export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center", className)} aria-label="zybble home">
      <span className="grid h-10 w-10 place-items-center rounded-[0.85rem] bg-gradient-to-br from-lime to-lime-2 text-ink shadow-[0_6px_20px_rgba(216,255,62,0.35)] ring-1 ring-ink/15 transition-all duration-500 group-hover:-rotate-6 group-hover:shadow-[0_8px_28px_rgba(216,255,62,0.55)]">
        <LogoMark className="h-5.5 w-5.5" />
      </span>
    </Link>
  );
}
