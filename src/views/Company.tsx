"use client";

import Link from "@/components/marketing/LinkCompat";
import { ArrowRight, Compass, HeartHandshake, ShieldCheck, Rocket, Gem, Globe2 } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "@/components/marketing/PageShell";
import { CTA } from "@/components/marketing/Footer";
import { Reveal, SectionTag } from "@/components/marketing/ui";
import { cn } from "@/lib/cn";

const STATS = [
  { v: "2023", l: "founded in Austin" },
  { v: "24", l: "people, 9 countries" },
  { v: "2,300+", l: "customers & counting" },
  { v: "41M", l: "leads generated / quarter" },
];

const VALUES = [
  { icon: Compass, t: "Maps over databases", d: "The freshest business data on earth is the map itself — updated by the businesses, daily. We build on truth, not warehouses." },
  { icon: Gem, t: "Quality is the product", d: "A lead that bounces is worse than no lead. We'd rather ship you 4,000 verified contacts than 10,000 guesses." },
  { icon: Rocket, t: "Speed is a feature", d: "From search to export in under ten minutes. If a workflow takes a manual, we haven't finished it." },
  { icon: ShieldCheck, t: "Compliance by default", d: "GDPR, CAN-SPAM, DPA — baked into the product, not bolted on by legal after the fact." },
  { icon: HeartHandshake, t: "Small teams, superpowers", d: "Our favorite customer is a two-person agency out-working a fifty-person firm. We build them leverage." },
  { icon: Globe2, t: "Local is global", d: "Every city on earth runs on local business. We're building the connective tissue between them and the tools that serve them." },
];

const TEAM = [
  { n: "Jonas Verbeeck", r: "Co-founder · CEO", i: "JV" },
  { n: "Amara Diallo", r: "Co-founder · CTO", i: "AD" },
  { n: "Felix Brandt", r: "Head of Data", i: "FB" },
  { n: "Yuki Tanaka", r: "Design Lead", i: "YT" },
  { n: "Carlos Mendes", r: "Head of AI", i: "CM" },
  { n: "Ingrid Solberg", r: "Customer Lead", i: "IS" },
  { n: "Dev Patel", r: "Growth", i: "DP" },
  { n: "Marie Laurent", r: "Compliance & Legal", i: "ML" },
];

const AV = ["bg-lime text-ink", "bg-forest text-lime", "bg-ink text-paper", "bg-cream text-ink border border-ink/15"];

export default function Company() {
  usePageMeta(
    "Company — zybble | About us",
    "zybble turns Google Maps into verified pipeline for 2,300+ teams. Meet the company behind the map engine.",
  );
  return (
    <main>
      <PageHero
        tag="Company"
        title={
          <>
            We think the map is the <Mark>largest lead database</Mark> on earth.
          </>
        }
        sub="zybble started in 2023 when our founders wasted a weekend manually copying plumber contacts from Google Maps into a spreadsheet. There had to be a better way. Now 2,300+ teams use it."
      />

      {/* story */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal>
            <div className="rounded-3xl border border-ink/10 bg-white/70 p-8 sm:p-12">
              <SectionTag>Our story</SectionTag>
              <div className="mt-6 grid gap-10 lg:grid-cols-2">
                <div className="space-y-5 text-[15.5px] leading-relaxed text-ink/70">
                  <p>
                    Jonas ran a growth agency. Amara built data pipelines. One Friday, a client asked for
                    "every HVAC company in the Carolinas" — and the honest answer was a VA, a spreadsheet,
                    and two weeks. That weekend, the first zybble crawler was born: a scrappy script that
                    read the map like a local and pulled structured records out of it.
                  </p>
                  <p>
                    The script worked embarrassing­ly well. Friends in sales wanted in. Then their teams.
                    The pattern was obvious: businesses already maintain the world's best business database
                    themselves — their own listings — and everyone was copying it by hand.
                  </p>
                </div>
                <div className="space-y-5 text-[15.5px] leading-relaxed text-ink/70">
                  <p>
                    Today zybble indexes 12M+ businesses, verifies contact data in real time, writes
                    outreach with AI that references real reviews, and runs campaigns for thousands of
                    teams — from two-person agencies to national sales orgs. The mission hasn't moved an
                    inch: <span className="font-semibold text-ink">make world-class prospecting feel unfair to everyone else.</span>
                  </p>
                  <p className="rounded-2xl bg-ink p-5 font-mono text-sm text-lime">
                    "The freshest business database on earth is maintained by the businesses themselves.
                    We just made it queryable." — Jonas, CEO
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.l} delay={0.05 * i}>
                <div className="rounded-3xl border border-ink/10 bg-white/70 p-7 text-center">
                  <p className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">{s.v}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink/50 sm:text-xs">{s.l}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* values */}
      <section className="bg-ink py-24 text-paper lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal>
            <SectionTag variant="dark">What we believe</SectionTag>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              Six values, zero asterisks
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.t} delay={0.05 * i}>
                <div className="h-full rounded-3xl border border-white/10 bg-white/[0.045] p-7 transition-colors duration-500 hover:border-lime/30">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime/15 text-lime">
                    <v.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{v.t}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-paper/55">{v.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* team */}
      <section className="border-b border-ink/10 py-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionTag>The humans</SectionTag>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">24 people, 9 countries, 1 map</h2>
            </div>
            <Link to="/careers" className="group flex items-center gap-2 rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold transition-colors hover:border-ink/40">
              We're hiring
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {TEAM.map((m, i) => (
              <Reveal key={m.n} delay={0.04 * i}>
                <div className="group rounded-3xl border border-ink/10 bg-white/70 p-6 text-center transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_56px_-24px_rgba(11,16,14,0.22)]">
                  <span className={cn("mx-auto grid h-16 w-16 place-items-center rounded-full font-display text-xl font-bold transition-transform duration-500 group-hover:scale-105", AV[i % AV.length])}>
                    {m.i}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{m.n}</h3>
                  <p className="mt-1 font-mono text-[11px] text-ink/50">{m.r}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10 text-center font-mono text-xs text-ink/45">
            backed by <span className="text-ink">North Peak Capital</span> · <span className="text-ink">Form Ventures</span> · <span className="text-ink">Daybreak Angels</span>
          </Reveal>
        </div>
      </section>

      <CTA />
    </main>
  );
}
