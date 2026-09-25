import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowUpRight, Building2, Users, Wrench, UserSearch, Flame } from "lucide-react";
import { Reveal, SectionTag, EASE } from "./ui";
import { cn } from "../utils/cn";

const CASES = [
  {
    id: "agencies",
    icon: Building2,
    label: "Agencies",
    headline: "Fill client rosters on autopilot",
    desc: "Spin up fresh, niche-perfect prospect lists for every client in minutes. White-label the exports and let the AI draft the first touch.",
    bullets: ["Ready-made niche packs: dentists, med-spas, roofers, gyms", "White-label CSVs branded per client", "AI icebreakers that reference real reviews"],
    searches: ["med spas · miami", "orthodontists · dallas", "boutique gyms · nyc"],
    metric: { v: "38", l: "niche packs ready to run" },
  },
  {
    id: "sales",
    icon: Users,
    label: "Sales teams",
    headline: "Territory lists in minutes, not months",
    desc: "Carve up regions, dedupe across reps, and push sequenced outreach the same day. Pipeline reviews get a lot more comfortable.",
    bullets: ["Filter by rating, size signals, and category", "Automatic dedupe across reps and lists", "Sequenced follow-ups with reply detection"],
    searches: ["hvac · ohio valley", "auto dealers · texas", "clinics · socal"],
    metric: { v: "6.2×", l: "more meetings per rep / mo" },
  },
  {
    id: "local",
    icon: Wrench,
    label: "Local services",
    headline: "Win your city before competitors wake up",
    desc: "Roofers, plumbers, landscapers — watch new businesses open nearby and be the first call they take.",
    bullets: ["New-listing alerts for your service area", "Review-triggered outreach moments", "SMS + call scripts written by AI"],
    searches: ["new openings · phoenix", "restaurants · austin", "salons · denver"],
    metric: { v: "92%", l: "of city covered in 1 search" },
  },
  {
    id: "recruiters",
    icon: UserSearch,
    label: "Recruiters",
    headline: "Spot hiring before it's posted",
    desc: "Find growing local companies by review velocity and headcount signals — and reach decision-makers directly, not an inbox bot.",
    bullets: ["Growth & hiring-signal detection", "Owner and ops-manager direct contacts", "Geography-locked talent pools"],
    searches: ["logistics · atlanta", "clinics expanding · ohio", "hospitality · vegas"],
    metric: { v: "3.4×", l: "faster first conversations" },
  },
];

export default function UseCases() {
  const [active, setActive] = useState(0);
  const c = CASES[active];
  const Icon = c.icon;

  return (
    <section id="use-cases" className="scroll-mt-28 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Reveal>
              <SectionTag>Use cases</SectionTag>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
                One map, a hundred plays
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.16}>
            <p className="max-w-sm text-lg text-ink/60">
              Pick your motion — the data source stays the same: 12M+ live local businesses.
            </p>
          </Reveal>
        </div>

        {/* tabs */}
        <Reveal delay={0.2}>
          <div className="mt-12 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CASES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActive(i)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-full border px-5 py-3 text-sm font-semibold transition-all duration-300",
                  i === active
                    ? "border-ink bg-ink text-paper shadow-[0_10px_30px_rgba(11,16,14,0.25)]"
                    : "border-ink/15 bg-white/60 text-ink/60 hover:border-ink/35 hover:text-ink",
                )}
              >
                <t.icon className={cn("h-4 w-4", i === active && "text-lime")} />
                {t.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* panel */}
        <div className="mt-5 overflow-hidden rounded-3xl border border-ink/10 bg-white/70">
          <AnimatePresence mode="wait">
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="grid lg:grid-cols-2"
            >
              {/* copy side */}
              <div className="p-7 sm:p-10">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
                    {c.label}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  {c.headline}
                </h3>
                <p className="mt-4 leading-relaxed text-ink/60">{c.desc}</p>
                <ul className="mt-7 space-y-3.5">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[0.95rem] text-ink/80">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest">
                        <Check className="h-3 w-3 text-lime" strokeWidth={3} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className="group mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4"
                >
                  Try this playbook
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>

              {/* visual side */}
              <div className="relative border-t border-ink/10 bg-ink p-7 text-paper sm:p-10 lg:border-l lg:border-t-0">
                <div
                  className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,243,236,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,243,236,0.04)_1px,transparent_1px)] bg-[size:34px_34px]"
                  aria-hidden
                />
                <div className="relative">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
                    saved searches
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.searches.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 font-mono text-xs text-paper/75"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-10">
                    <p className="font-display text-6xl font-bold tracking-tight text-lime sm:text-7xl">
                      {c.metric.v}
                    </p>
                    <p className="mt-2 font-mono text-xs uppercase tracking-wider text-paper/50">
                      {c.metric.l}
                    </p>
                  </div>

                  <div className="mt-10 flex items-center gap-3 rounded-2xl border border-lime/25 bg-lime/10 px-4 py-3.5">
                    <Flame className="h-5 w-5 shrink-0 text-lime" />
                    <p className="text-sm leading-snug text-paper/85">
                      Teams in this segment book their first meeting within{" "}
                      <span className="font-semibold text-lime">48 hours</span> of the first export.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
