"use client";

import Link from "@/components/marketing/LinkCompat";
import { ShieldCheck, FileText, ArrowRight } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "@/components/marketing/PageShell";
import { Reveal } from "@/components/marketing/ui";
import { getLegal, LEGAL_DOCS } from "@/data/legal";

export default function LegalPage({ slug }: { slug: string }) {
  const doc = getLegal(slug);
  const others = LEGAL_DOCS.filter((d) => d.slug !== doc.slug);

  usePageMeta(`${doc.title} — zybble`, doc.intro);

  return (
    <main>
      <PageHero
        tag="Legal"
        title={
          <>
            {doc.title}
          </>
        }
        sub={doc.intro}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-4 py-2 font-mono text-xs text-ink/60">
            <ShieldCheck className="h-4 w-4 text-lime-2" />
            last updated · {doc.updated}
          </span>
          {doc.note && (
            <span className="flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-4 py-2 font-mono text-xs text-ink/60">
              <FileText className="h-4 w-4 text-lime-2" />
              {doc.note}
            </span>
          )}
        </div>
      </PageHero>

      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12">
            {/* sticky TOC */}
            <aside className="hidden lg:col-span-3 lg:block">
              <div className="sticky top-28 rounded-2xl border border-ink/10 bg-white/60 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/40">On this page</p>
                <nav className="mt-3 space-y-0.5">
                  {doc.sections.map((s, i) => (
                    <a
                      key={s.h}
                      href={`#s-${i}`}
                      className="block rounded-lg px-3 py-2 text-[13px] text-ink/60 transition-colors hover:bg-lime/20 hover:text-ink"
                    >
                      {s.h}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* document */}
            <div className="lg:col-span-9">
              <div className="space-y-4">
                {doc.sections.map((s, i) => (
                  <Reveal key={s.h} delay={0.02 * i}>
                    <section
                      id={`s-${i}`}
                      className="scroll-mt-28 rounded-3xl border border-ink/10 bg-white/70 p-7 sm:p-9"
                    >
                      <div className="flex items-start gap-4">
                        <span className="font-display text-2xl font-bold text-lime-2">{String(i + 1).padStart(2, "0")}</span>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{s.h}</h2>
                          <div className="mt-4 space-y-4">
                            {s.body.map((b, bi) =>
                              b.p ? (
                                <p key={bi} className="text-[15px] leading-[1.8] text-ink/70">{b.p}</p>
                              ) : (
                                <ul key={bi} className="space-y-2.5">
                                  {b.list!.map((li) => (
                                    <li key={li.slice(0, 32)} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/70">
                                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-lime-2" />
                                      {li}
                                    </li>
                                  ))}
                                </ul>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  </Reveal>
                ))}
              </div>

              {/* other docs */}
              <Reveal className="mt-10">
                <div className="rounded-3xl bg-ink p-7 text-paper sm:p-8">
                  <h3 className="font-display text-xl font-bold tracking-tight">
                    More from the <Mark>legal</Mark> shelf
                  </h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {others.map((d) => (
                      <Link
                        key={d.slug}
                        to={`/${d.slug}`}
                        className="group flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm font-semibold transition-colors hover:border-lime/40 hover:bg-lime/10"
                      >
                        {d.title}
                        <ArrowRight className="h-4 w-4 shrink-0 text-lime transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>
                  <p className="mt-5 font-mono text-xs text-paper/40">
                    questions? <a href="mailto:compliance@zybble.io" className="text-lime underline underline-offset-2">compliance@zybble.io</a> — we answer like humans, not law firms.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
