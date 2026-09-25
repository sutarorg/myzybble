"use client";

import { useState } from "react";
import Link from "@/components/marketing/LinkCompat";
import { motion } from "framer-motion";
import { ArrowBigUp, CircleDot, Compass, Milestone, CheckCircle2, Lightbulb } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "@/components/marketing/PageShell";
import { Reveal } from "@/components/marketing/ui";
import { cn } from "@/lib/cn";

type Item = { id: string; tag: string; title: string; desc: string; votes: number };
const COLUMNS: { id: string; label: string; icon: typeof Compass; hint: string; items: Item[] }[] = [
  {
    id: "now",
    label: "Building now",
    icon: CircleDot,
    hint: "shipping this quarter",
    items: [
      { id: "n1", tag: "Campaigns", title: "AI reply classification", desc: "Inbox auto-labels replies: interested, objection, referral, unsubscribe.", votes: 481 },
      { id: "n2", tag: "Integrations", title: "Salesforce sync", desc: "Two-way lead + campaign status sync with custom field mapping.", votes: 392 },
      { id: "n3", tag: "Search", title: "Search chains v2", desc: "State-wide sweeps with automatic city expansion and pause/resume.", votes: 347 },
      { id: "n4", tag: "Deliverability", title: "Inbox rotation", desc: "Rotate sending across connected mailboxes with per-inbox pacing.", votes: 298 },
    ],
  },
  {
    id: "next",
    label: "Up next",
    icon: Compass,
    hint: "scoping & design",
    items: [
      { id: "x1", tag: "Data", title: "Intent scoring", desc: "Rank leads by hiring velocity, review momentum, and growth signals.", votes: 512 },
      { id: "x2", tag: "Campaigns", title: "LinkedIn touchpoints", desc: "Add profile-visit and connection steps into sequences.", votes: 438 },
      { id: "x3", tag: "Workspace", title: "Roles & permissions", desc: "Admin / rep / viewer roles with per-territory visibility.", votes: 271 },
      { id: "x4", tag: "Search", title: "Lookalike niches", desc: "Give zybble a winning list; it suggests adjacent niches to sweep.", votes: 256 },
    ],
  },
  {
    id: "later",
    label: "Exploring",
    icon: Milestone,
    hint: "want it? vote it up",
    items: [
      { id: "l1", tag: "Campaigns", title: "SMS steps", desc: "Compliant SMS follow-ups with auto opt-out handling.", votes: 604 },
      { id: "l2", tag: "Distribution", title: "Chrome extension", desc: "One-click add to campaign from any Maps listing you browse.", votes: 355 },
      { id: "l3", tag: "Marketplace", title: "Niche packs store", desc: "Buy pre-verified packs built by top-performing agencies.", votes: 233 },
      { id: "l4", tag: "Campaigns", title: "WhatsApp outreach", desc: "Business-API WhatsApp steps for EU & LATAM markets.", votes: 189 },
    ],
  },
];

export default function Roadmap() {
  usePageMeta(
    "Roadmap — zybble | What's shipping next",
    "The public zybble roadmap: AI reply classification, Salesforce sync, intent scoring and more. Vote on what ships next.",
  );
  const [votes, setVotes] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.flatMap((c) => c.items.map((i) => [i.id, i.votes]))),
  );
  const [voted, setVoted] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setVotes((v) => ({ ...v, [id]: v[id] + (voted.has(id) ? -1 : 1) }));
    setVoted((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <main>
      <PageHero
        tag="Roadmap"
        title={
          <>
            The queue is <Mark>public</Mark>. The votes are yours.
          </>
        }
        sub="Everything we're building, scoping, or considering. Upvote what would change your quarter — we build in vote order."
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-ink/50">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-lime-2" /> shipped weekly — see <Link to="/changelog" className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4">changelog</Link></span>
          <span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-lime-2" /> request a feature via <Link to="/contact" className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4">contact</Link></span>
        </div>
      </PageHero>

      <section className="pb-24 lg:pb-32">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {COLUMNS.map((c, ci) => (
              <Reveal key={c.id} delay={0.08 * ci}>
                <div className="h-full rounded-3xl border border-ink/10 bg-white/50 p-4 sm:p-5">
                  <div className="flex items-center justify-between px-2 pb-4 pt-1">
                    <div className="flex items-center gap-2.5">
                      <c.icon className="h-4.5 w-4.5 text-ink/60" />
                      <h2 className="font-display text-lg font-bold tracking-tight">{c.label}</h2>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">{c.hint}</span>
                  </div>
                  <div className="space-y-3">
                    {c.items.map((it) => {
                      const active = voted.has(it.id);
                      return (
                        <div
                          key={it.id}
                          className="group rounded-2xl border border-ink/10 bg-paper p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_18px_44px_-16px_rgba(11,16,14,0.2)]"
                        >
                          <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ink/55">
                            {it.tag}
                          </span>
                          <h3 className="mt-3 font-display text-lg font-bold tracking-tight">{it.title}</h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{it.desc}</p>
                          <button
                            onClick={() => toggle(it.id)}
                            aria-pressed={active}
                            className={cn(
                              "mt-4 flex items-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-xs font-semibold transition-all duration-200 active:scale-95",
                              active
                                ? "border-lime bg-lime text-ink shadow-[0_0_24px_rgba(216,255,62,0.4)]"
                                : "border-ink/15 text-ink/60 hover:border-ink/45 hover:text-ink",
                            )}
                          >
                            <motion.span
                              key={String(active)}
                              initial={{ y: active ? 6 : -6, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center gap-1.5"
                            >
                              <ArrowBigUp className="h-4 w-4" />
                              {votes[it.id].toLocaleString()}
                            </motion.span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <div className="rounded-3xl bg-ink p-7 text-paper sm:p-9">
              <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-2xl font-bold tracking-tight">Missing your lever?</h3>
                  <p className="mt-2 max-w-lg text-paper/60">
                    The most-requested items ship first — SMS steps jumped the queue with 600+ votes. Tell us
                    what would 10× your outbound.
                  </p>
                </div>
                <Link
                  to="/contact"
                  className="shrink-0 rounded-full bg-lime px-7 py-3.5 font-bold text-ink transition-shadow hover:shadow-[0_0_36px_rgba(216,255,62,0.5)]"
                >
                  Request a feature
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
