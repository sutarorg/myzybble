"use client";

import Link from "@/components/marketing/LinkCompat";
import { ArrowRight, Quote, XCircle, Building2, Users, Wrench, UserSearch, MapPin } from "lucide-react";
import { PageHero, usePageMeta } from "@/components/marketing/PageShell";
import { CTA } from "@/components/marketing/Footer";
import { Reveal, SectionTag } from "@/components/marketing/ui";
import { getPersona, PERSONAS } from "@/data/personas";
import { cn } from "@/lib/cn";

const ICONS = { Building2, Users, Wrench, UserSearch } as const;

export default function PersonaPage({ slug }: { slug: string }) {
  const p = getPersona(slug);
  const Icon = ICONS[p.icon];
  const others = PERSONAS.filter((x) => x.slug !== p.slug).slice(0, 3);

  usePageMeta(
    `${p.label} — zybble | Google Maps lead generation for ${p.label.toLowerCase()}`,
    `${p.tagline}. ${p.headline}. Verified emails & phones, AI outreach, CSV export from $19/mo.`,
  );

  return (
    <main>
      <PageHero
        tag={p.tagline}
        title={
          <>
            {p.headline.split(" ").length > 4 ? (
              <>
                {p.headline}
              </>
            ) : (
              p.headline
            )}
          </>
        }
        sub={p.sub}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-[3.25rem] w-[3.25rem] place-items-center rounded-2xl bg-ink text-lime">
            <Icon className="h-5.5 w-5.5" />
          </span>
          <Link to="/signup" className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-semibold text-paper transition-all hover:bg-ink-3">
            Try the {p.label.toLowerCase()} playbook
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
          </Link>
          <div className="flex flex-wrap gap-2">
            {p.searches.slice(0, 3).map((s) => (
              <span key={s} className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-3.5 py-2 font-mono text-xs text-ink/65">
                <MapPin className="h-3.5 w-3.5 text-lime-2" />
                {s}
              </span>
            ))}
          </div>
        </div>
      </PageHero>

      {/* pains */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal>
            <SectionTag>The problem</SectionTag>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              Sound familiar?
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {p.pains.map((pain, i) => (
              <Reveal key={pain.t} delay={0.07 * i}>
                <div className="h-full rounded-3xl border border-ink/10 bg-white/70 p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_rgba(11,16,14,0.2)]">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/[0.08]">
                    <XCircle className="h-5 w-5 text-red-500/80" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{pain.t}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink/60">{pain.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* playbook */}
      <section className="bg-ink py-24 text-paper lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Reveal>
                <SectionTag variant="dark">The zybble playbook</SectionTag>
              </Reveal>
              <Reveal delay={0.08}>
                <h2 className="mt-5 max-w-xl font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
                  Four steps. One <span className="text-lime">afternoon</span>.
                </h2>
              </Reveal>
            </div>
            <Reveal delay={0.14} className="max-w-sm text-paper/55">
              This is the exact workflow top {p.label.toLowerCase()} run on zybble — from zero to a live,
              verified, AI-personalized campaign.
            </Reveal>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.playbook.map((s, i) => (
              <Reveal key={s.t} delay={0.07 * i}>
                <div className="relative h-full rounded-3xl border border-white/10 bg-white/[0.045] p-6 transition-colors duration-500 hover:border-lime/30">
                  <span className="font-display text-5xl font-bold text-lime/15">0{i + 1}</span>
                  <h3 className="mt-4 font-display text-xl font-bold tracking-tight">{s.t}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-paper/55">{s.d}</p>
                  {i < p.playbook.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-lime/60 lg:block" />
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          {/* metrics */}
          <div className="mt-14 grid grid-cols-3 gap-6 border-t border-white/10 pt-10">
            {p.metrics.map((m, i) => (
              <Reveal key={m.l} delay={0.06 * i} className="text-center sm:text-left">
                <p className="font-display text-4xl font-bold tracking-tight text-lime sm:text-5xl">{m.v}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-paper/50 sm:text-xs">{m.l}</p>
              </Reveal>
            ))}
          </div>

          {/* quote */}
          <Reveal delay={0.1}>
            <figure className="mt-14 rounded-3xl border border-lime/20 bg-lime/[0.06] p-8 sm:p-10">
              <Quote className="h-8 w-8 text-lime" />
              <blockquote className="mt-5 max-w-3xl font-display text-xl font-medium leading-relaxed sm:text-2xl">
                “{p.quote.text}”
              </blockquote>
              <figcaption className="mt-5 font-mono text-xs text-paper/55">
                {p.quote.name} · {p.quote.role}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* other motions */}
      <section className="border-b border-ink/10 py-20">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal className="flex items-end justify-between gap-6">
            <div>
              <SectionTag>More motions</SectionTag>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Not your team?</h2>
            </div>
            <Link to="/use-cases" className="hidden shrink-0 font-mono text-xs text-ink/50 underline decoration-lime decoration-2 underline-offset-4 hover:text-ink sm:block">
              view all use cases →
            </Link>
          </Reveal>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {others.map((o, i) => {
              const OI = ICONS[o.icon];
              return (
                <Reveal key={o.slug} delay={0.06 * i}>
                  <Link
                    to={`/${o.slug}`}
                    className={cn(
                      "group flex h-full flex-col rounded-2xl border border-ink/10 bg-white/70 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_20px_50px_-20px_rgba(11,16,14,0.2)]",
                    )}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-lime">
                      <OI className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{o.label}</h3>
                    <p className="mt-1 text-sm text-ink/55">{o.headline}</p>
                    <span className="mt-4 flex items-center gap-1.5 font-mono text-[11px] text-ink/45 group-hover:text-ink">
                      explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <CTA />
    </main>
  );
}
