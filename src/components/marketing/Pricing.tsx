"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "@/components/marketing/LinkCompat";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, FileDown, Sparkles, Send, Flame } from "lucide-react";
import { Reveal, SectionTag, EASE } from "./ui";
import { cn } from "@/lib/cn";

const PLANS = [
  { name: "Starter", short: "5k", leads: 5_000, price: 19 },
  { name: "Growth", short: "15k", leads: 15_000, price: 39 },
  { name: "Pro", short: "30k", leads: 30_000, price: 69, popular: true },
  { name: "Scale", short: "50k", leads: 50_000, price: 99 },
  { name: "Business", short: "75k", leads: 75_000, price: 149 },
  { name: "Agency", short: "100k", leads: 100_000, price: 199 },
];

const INCLUDED = [
  { icon: Mail, label: "Email & phone data" },
  { icon: FileDown, label: "CSV export" },
  { icon: Sparkles, label: "AI Assistant" },
  { icon: Send, label: "Campaigns" },
];

function Swap({ k, children, className }: { k: string | number; children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={k}
          initial={{ y: "60%", opacity: 0, filter: "blur(4px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-60%", opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.32, ease: EASE }}
          className="inline-block"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* Interactive pricing card (landing + pricing page) */
export function PricingCard() {
  const [idx, setIdx] = useState(2);
  const plan = PLANS[idx];
  const fill = (idx / (PLANS.length - 1)) * 100;
  const perK = ((plan.price / plan.leads) * 1000).toFixed(2);

  return (
    <div className="relative rounded-[1.8rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.6)] backdrop-blur sm:p-10">
      <div
        className="pointer-events-none absolute inset-x-16 -top-px h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent"
        aria-hidden
      />

      {/* header: volume + plan */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/45">Monthly lead volume</p>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {plan.popular && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.7, rotate: 6 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink"
              >
                <Flame className="h-3 w-3" />
                most popular
              </motion.span>
            )}
          </AnimatePresence>
          <Swap
            k={plan.name}
            className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 font-mono text-xs text-paper"
          >
            {plan.name}
          </Swap>
        </div>
      </div>

      {/* big volume */}
      <p className="mt-6 font-display text-5xl font-bold leading-none tracking-tight text-lime sm:text-6xl">
        <Swap k={plan.leads}>{plan.leads.toLocaleString("en-US")}</Swap>
        <span className="ml-2 align-middle font-mono text-sm font-medium tracking-normal text-paper/45 sm:text-base">
          leads / mo
        </span>
      </p>

      {/* slider */}
      <div className="mt-9 sm:mt-10">
        <input
          type="range"
          min={0}
          max={PLANS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="range-lime"
          style={{ ["--fill" as string]: `${fill}%` }}
          aria-label="Monthly lead volume"
        />
        <div className="relative mx-[15px] mt-4 h-9">
          {PLANS.map((p, i) => (
            <button
              key={p.short}
              onClick={() => setIdx(i)}
              style={{ left: `${(i / (PLANS.length - 1)) * 100}%` }}
              className="group absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1"
              aria-label={`${p.leads.toLocaleString()} leads for $${p.price}`}
            >
              <span
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === idx
                    ? "h-2 w-2 bg-lime shadow-[0_0_0_4px_rgba(216,255,62,0.25)]"
                    : "h-1.5 w-1.5 bg-white/25 group-hover:bg-white/55",
                )}
              />
              <span
                className={cn(
                  "font-mono text-[10px] transition-colors sm:text-xs",
                  i === idx ? "font-semibold text-lime" : "text-paper/40 group-hover:text-paper/70",
                )}
              >
                {p.short}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* price + cta */}
      <div className="mt-8 flex flex-col gap-5 border-t border-white/10 pt-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-6xl font-bold tracking-tight sm:text-7xl">
              <Swap k={plan.price}>${plan.price}</Swap>
            </span>
            <span className="font-mono text-sm text-paper/45">/month</span>
          </p>
          <p className="mt-2 font-mono text-xs text-paper/45">
            ≈ <span className="text-lime">${perK}</span> per 1,000 leads
          </p>
        </div>
        <Link
          to="/signup"
          className="group flex items-center justify-center gap-2 rounded-full bg-lime px-8 py-4 text-[0.95rem] font-bold text-ink transition-all duration-300 hover:shadow-[0_0_44px_rgba(216,255,62,0.45)] sm:shrink-0"
        >
          Start with {plan.name}
          <ArrowRight className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>

      {/* every plan */}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-white/10 pt-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/45">Every plan</span>
        {INCLUDED.map((f) => (
          <span key={f.label} className="flex items-center gap-2 text-[13px] font-medium text-paper/75">
            <f.icon className="h-4 w-4 text-lime" />
            {f.label}
          </span>
        ))}
        <span className="ml-auto hidden font-mono text-[10.5px] text-paper/35 sm:block">
          100 free leads · no card
        </span>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-16 overflow-hidden bg-ink py-24 text-paper lg:py-32">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,243,236,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,243,236,0.03)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]"
        aria-hidden
      />
      <div className="absolute -top-32 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-lime/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-5xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <SectionTag variant="dark">Pricing</SectionTag>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              One slider. Every feature included.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 text-lg text-paper/55">
              Six volume tiers — features never change. Drag to find your volume, start free, scale when
              it works.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.2} className="mt-14">
          <PricingCard />
        </Reveal>
      </div>
    </section>
  );
}
