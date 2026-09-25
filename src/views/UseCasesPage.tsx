"use client";

import Link from "@/components/marketing/LinkCompat";
import { ArrowRight, Building2, Users, Wrench, UserSearch } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "@/components/marketing/PageShell";
import UseCases from "@/components/marketing/UseCases";
import { CTA } from "@/components/marketing/Footer";
import { Reveal } from "@/components/marketing/ui";

const CARDS = [
  {
    to: "/agencies",
    icon: Building2,
    label: "Agencies",
    headline: "Fill client rosters on autopilot",
    bullets: ["38 ready-made niche packs", "White-label CSV exports", "AI icebreakers that read like homework"],
  },
  {
    to: "/sales-teams",
    icon: Users,
    label: "Sales teams",
    headline: "Territory lists in minutes, not months",
    bullets: ["Filter by rating, size & category", "Cross-rep duplicate protection", "Sequenced follow-ups built in"],
  },
  {
    to: "/local-services",
    icon: Wrench,
    label: "Local services",
    headline: "Win your city before competitors wake up",
    bullets: ["New-listing alerts for your area", "Review-triggered outreach moments", "SMS + call scripts by AI"],
  },
  {
    to: "/recruiters",
    icon: UserSearch,
    label: "Recruiters",
    headline: "Spot hiring before it's posted",
    bullets: ["Growth & hiring-signal detection", "Decision-maker direct contacts", "Geography-locked talent pools"],
  },
];

const BANDS = [
  { v: "41M", l: "leads generated last quarter" },
  { v: "2,300+", l: "teams building pipeline" },
  { v: "98.2%", l: "average verify rate" },
  { v: "6.2×", l: "more meetings per rep" },
];

export default function UseCasesPage() {
  usePageMeta(
    "Use cases — zybble | Lead generation for every motion",
    "Agencies, sales teams, local services and recruiters use zybble to turn Google Maps into pipeline. Pick your playbook.",
  );
  return (
    <main>
      <PageHero
        tag="Use cases"
        title={
          <>
            One map. <Mark>Every</Mark> growth motion.
          </>
        }
        sub="Four teams, one data source: 12M+ live local businesses with verified contacts. Pick your playbook and deep-dive into your motion."
      />

      {/* persona cards */}
      <section className="pb-8">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {CARDS.map((c, i) => (
              <Reveal key={c.to} delay={0.06 * i}>
                <Link
                  to={c.to}
                  className="group flex h-full flex-col rounded-3xl border border-ink/10 bg-white/70 p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-ink/25 hover:shadow-[0_30px_70px_-24px_rgba(11,16,14,0.25)]"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-lime transition-transform duration-500 group-hover:-rotate-6">
                      <c.icon className="h-5.5 w-5.5" />
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 transition-all duration-300 group-hover:border-ink group-hover:bg-lime">
                      <ArrowRight className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">for {c.label}</p>
                  <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-[1.7rem]">{c.headline}</h2>
                  <ul className="mt-5 space-y-2.5">
                    {c.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2.5 text-sm text-ink/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-lime-2" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto pt-6 font-mono text-xs text-ink/45 underline decoration-lime decoration-2 underline-offset-4 group-hover:text-ink">
                    explore the playbook →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* interactive tabs (from landing) for quick preview */}
      <UseCases />

      {/* metrics band */}
      <section className="bg-ink py-16 text-paper">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.24em] text-paper/45">
              Proof, not promises
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {BANDS.map((b, i) => (
              <Reveal key={b.l} delay={0.06 * i} className="text-center">
                <p className="font-display text-5xl font-bold tracking-tight text-lime">{b.v}</p>
                <p className="mt-2 font-mono text-xs uppercase tracking-wider text-paper/50">{b.l}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTA />
    </main>
  );
}
