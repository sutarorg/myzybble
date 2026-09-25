"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { SectionTag, EASE } from "./ui";

/* Per-page SEO meta */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", description);
  }, [title, description]);
}

/* Standard page hero: light, grid bg, tag + display title + sub */
export function PageHero({
  tag,
  title,
  sub,
  children,
}: {
  tag: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden pb-14 pt-32 sm:pt-36 lg:pb-20 lg:pt-44">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(11,16,14,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(11,16,14,0.045)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(ellipse_75%_80%_at_50%_0%,black,transparent)]"
        aria-hidden
      />
      <div
        className="absolute -top-24 left-1/2 h-64 w-[34rem] -translate-x-1/2 rounded-full bg-lime/20 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <SectionTag>{tag}</SectionTag>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.04] tracking-[-0.03em] sm:text-6xl"
        >
          {title}
        </motion.h1>
        {sub && (
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
            className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/65"
          >
            {sub}
          </motion.p>
        )}
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
            className="mt-8"
          >
            {children}
          </motion.div>
        )}
      </div>
    </header>
  );
}

/* Highlighted word for page titles */
export function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span className="absolute inset-x-[-0.12em] bottom-[0.02em] top-[0.55em] -rotate-1 rounded-[0.15em] bg-lime" aria-hidden />
      <span className="relative">{children}</span>
    </span>
  );
}
