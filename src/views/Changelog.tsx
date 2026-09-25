"use client";

import { useState } from "react";
import Link from "@/components/marketing/LinkCompat";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, Tag } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "@/components/marketing/PageShell";
import { Reveal, EASE } from "@/components/marketing/ui";
import { cn } from "@/lib/cn";

type Kind = "new" | "improved" | "fixed";
const KIND_META: Record<Kind, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-lime text-ink" },
  improved: { label: "Improved", cls: "bg-ink text-paper" },
  fixed: { label: "Fixed", cls: "bg-ink/[0.08] text-ink/60" },
};

const RELEASES: { v: string; date: string; title: string; items: { kind: Kind; text: string }[] }[] = [
  {
    v: "2.4.0",
    date: "Feb 2026",
    title: "AI Assistant 2.0",
    items: [
      { kind: "new", text: "Review-aware icebreakers — the Assistant now quotes live reviews, ratings and niches in every opener." },
      { kind: "new", text: "HubSpot sync v2 with field mapping and two-way campaign status." },
      { kind: "improved", text: "Verification rate raised to 98.2% average across all exported records." },
      { kind: "improved", text: "Search chains now stream results 3× faster with live progress." },
      { kind: "fixed", text: "Duplicate flagging across workspaces with overlapping territories." },
    ],
  },
  {
    v: "2.3.0",
    date: "Jan 2026",
    title: "Multi-city search chains",
    items: [
      { kind: "new", text: "Queue hundreds of niche + geo combos into one run — zybble chains them automatically." },
      { kind: "new", text: "CSV column mapper: rename, reorder and template your exports per client." },
      { kind: "improved", text: "Duplicate protection now runs across teams, not just per user." },
      { kind: "fixed", text: "Edge case where franchise locations shared a single phone record." },
    ],
  },
  {
    v: "2.2.0",
    date: "Dec 2025",
    title: "Smarter sequences",
    items: [
      { kind: "new", text: "Reply detection with instant sequence pause the moment a human answers." },
      { kind: "new", text: "Follow-up steps conditioned on opens, clicks, and no-answer windows." },
      { kind: "improved", text: "Human-like send pacing across time zones." },
    ],
  },
  {
    v: "2.1.0",
    date: "Nov 2025",
    title: "Phone intelligence",
    items: [
      { kind: "new", text: "Line-type detection — mobile vs. landline labeled on every number." },
      { kind: "new", text: "Confidence scores on all contact records." },
      { kind: "fixed", text: "International formatting for UK & EU numbers." },
    ],
  },
  {
    v: "2.0.0",
    date: "Oct 2025",
    title: "Campaigns launch",
    items: [
      { kind: "new", text: "Campaigns: multichannel outreach with AI-written sequences, built in. Every plan." },
      { kind: "new", text: "AI Assistant beta — one-click personalized first lines." },
      { kind: "improved", text: "Dashboard rebuilt for speed: 10× faster list rendering." },
    ],
  },
  {
    v: "1.9.0",
    date: "Sep 2025",
    title: "The export update",
    items: [
      { kind: "new", text: "One-click push to Pipedrive and Clay, with dedupe intact." },
      { kind: "new", text: "UTF-8 CSV templates per CRM." },
      { kind: "improved", text: "Hard-bounce refunds now automatic — no ticket required." },
    ],
  },
];

const FILTERS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "improved", label: "Improved" },
  { id: "fixed", label: "Fixed" },
];

export default function Changelog() {
  usePageMeta(
    "Changelog — zybble",
    "Everything new in zybble: AI Assistant 2.0, multi-city search chains, campaign reply detection and more.",
  );
  const [filter, setFilter] = useState<Kind | "all">("all");

  return (
    <main>
      <PageHero
        tag="Changelog"
        title={
          <>
            What&apos;s <Mark>new</Mark> on the map
          </>
        }
        sub="We ship weekly. Here's every release, improvement, and fix — newest first."
      >
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-5 py-2.5 text-sm font-semibold transition-all",
                filter === f.id
                  ? "border-ink bg-ink text-paper shadow-[0_10px_30px_rgba(11,16,14,0.25)]"
                  : "border-ink/15 bg-white/70 text-ink/60 hover:border-ink/40 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </PageHero>

      <section className="pb-24 lg:pb-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <div className="relative">
            <div className="absolute bottom-4 left-[13px] top-4 w-px bg-ink/12" aria-hidden />
            <div className="space-y-10">
              {RELEASES.map((r, ri) => {
                const items = filter === "all" ? r.items : r.items.filter((i) => i.kind === filter);
                if (items.length === 0) return null;
                return (
                  <Reveal key={r.v} delay={ri * 0.04}>
                    <div className="relative pl-12">
                      <span className="absolute left-0 top-2 grid h-7 w-7 place-items-center rounded-full border border-ink/10 bg-paper">
                        <Tag className="h-3.5 w-3.5 text-ink/50" />
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-ink px-3.5 py-1.5 font-mono text-xs font-bold text-lime">
                          v{r.v}
                        </span>
                        <h2 className="font-display text-2xl font-bold tracking-tight">{r.title}</h2>
                        <span className="font-mono text-xs text-ink/45">{r.date}</span>
                      </div>
                      <AnimatePresence mode="popLayout">
                        <motion.ul
                          layout
                          className="mt-5 space-y-2.5"
                          initial={false}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                        >
                          {items.map((it) => (
                            <motion.li
                              layout
                              key={it.text}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12 }}
                              transition={{ duration: 0.3, ease: EASE }}
                              className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white/70 p-4"
                            >
                              <span className={cn("mt-0.5 shrink-0 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider", KIND_META[it.kind].cls)}>
                                {KIND_META[it.kind].label}
                              </span>
                              <span className="text-[15px] leading-relaxed text-ink/75">{it.text}</span>
                            </motion.li>
                          ))}
                        </motion.ul>
                      </AnimatePresence>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>

          <Reveal className="mt-14">
            <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-ink/10 bg-white/70 p-7 sm:flex-row">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-lime">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold tracking-tight">Want a say in what ships?</h3>
                  <p className="text-sm text-ink/55">Vote on the roadmap — the queue is public.</p>
                </div>
              </div>
              <Link
                to="/roadmap"
                className="group inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-bold text-ink transition-shadow hover:shadow-[0_0_36px_rgba(216,255,62,0.5)]"
              >
                <Sparkles className="h-4 w-4" />
                View roadmap
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
