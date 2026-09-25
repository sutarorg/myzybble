"use client";

import Link from "@/components/marketing/LinkCompat";
import { ArrowRight, Clock3, MousePointerClick, Database, ShieldCheck, BrainCircuit, Send, FileDown } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "@/components/marketing/PageShell";
import HowItWorks from "@/components/marketing/HowItWorks";
import { CTA } from "@/components/marketing/Footer";
import { Reveal, SectionTag } from "@/components/marketing/ui";
import { cn } from "@/lib/cn";

const PIPELINE = [
  {
    icon: MousePointerClick,
    t: "Query build",
    time: "0:00",
    desc: "Your niche + city is expanded into a grid of geo-queries — neighborhoods, zips, category variants — so coverage is total, not sampled.",
  },
  {
    icon: Database,
    t: "Crawl & structure",
    time: "0:20",
    desc: "Every listing is crawled: name, address, category, rating, review velocity, hours, website. Raw soup becomes structured records.",
  },
  {
    icon: ShieldCheck,
    t: "Match & verify",
    time: "1:40",
    desc: "Contacts are matched from licensed B2B sources, then emails pass SMTP verification and phones are line-type checked. Low-confidence rows are quarantined, not exported.",
  },
  {
    icon: BrainCircuit,
    t: "AI personalization",
    time: "2:10",
    desc: "The Assistant reads each business's reviews, rating and niche, and drafts a unique opener plus a full follow-up sequence per record.",
  },
  {
    icon: Send,
    t: "Campaign launch",
    time: "4:30",
    desc: "Sequences go out with human-like pacing. Replies are detected in seconds and the sequence pauses the moment a human answers.",
  },
  {
    icon: FileDown,
    t: "Export & sync",
    time: "5:00",
    desc: "One click produces a column-perfect CSV, or pushes straight into HubSpot, Pipedrive, Salesforce or Clay with dedupe intact.",
  },
];

const FAQS = [
  {
    q: "Do I need proxies, APIs, or a Google account?",
    a: "No. zybble runs the entire crawl on its own infrastructure. You never touch a proxy, an API key, or a browser extension — you just type a niche and a city.",
  },
  {
    q: "How fresh is the data when I export?",
    a: "Records are verified at export time, not pulled from a warehouse. Anything that fails verification at that moment is excluded or flagged — you never pay for it.",
  },
  {
    q: "Can I see what the AI will send before it goes out?",
    a: "Always. You can review, edit, approve, or regenerate any opener or sequence before launch, and set approval rules per campaign.",
  },
  {
    q: "What happens when someone replies?",
    a: "Reply detection pauses that contact's sequence instantly and surfaces the thread in your inbox view, with the original lead record attached for context.",
  },
];

export default function HowItWorksPage() {
  usePageMeta(
    "How it works — zybble | From map search to verified pipeline",
    "See exactly how zybble turns a Google Maps search into verified leads and AI-powered outreach in under ten minutes.",
  );
  return (
    <main>
      <PageHero
        tag="How it works"
        title={
          <>
            From map search to meetings in <Mark>three moves</Mark>
          </>
        }
        sub="No proxies, no scripts, no stale databases. Here's the whole machine — and what happens under the hood in the first five minutes."
      >
        <div className="flex flex-wrap gap-3">
          <Link to="/signup" className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-semibold text-paper transition-all hover:bg-ink-3">
            Run your first search
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-7 py-4 font-semibold transition-colors hover:border-ink/40">
            See pricing
          </Link>
        </div>
      </PageHero>

      {/* main 3-step section (dark) */}
      <HowItWorks />

      {/* under the hood timeline */}
      <section className="border-b border-ink/10 py-24 lg:py-32">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <div className="text-center">
            <Reveal>
              <SectionTag>Under the hood</SectionTag>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
                The first five minutes, timestamped
              </h2>
            </Reveal>
          </div>

          <div className="relative mt-16">
            <div className="absolute bottom-6 left-[27px] top-6 w-px bg-ink/12 sm:left-1/2" aria-hidden />
            <div className="space-y-8">
              {PIPELINE.map((s, i) => (
                <Reveal key={s.t} delay={0.05 * i}>
                  <div className={cn("relative flex gap-6 sm:w-1/2", i % 2 === 0 ? "sm:pr-12" : "sm:ml-auto sm:pl-12")}>
                    <span
                      className={cn(
                        "absolute top-7 hidden h-3 w-3 rounded-full border-2 border-paper bg-lime shadow-[0_0_0_4px_rgba(216,255,62,0.3)] sm:block",
                        i % 2 === 0 ? "-right-[7px]" : "-left-[7px]",
                      )}
                      aria-hidden
                    />
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-lime sm:hidden">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 rounded-2xl border border-ink/10 bg-white/70 p-6 transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_rgba(11,16,14,0.2)]">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-xl font-bold tracking-tight">{s.t}</h3>
                        <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink/45">
                          <Clock3 className="h-3.5 w-3.5" />
                          {s.time}
                        </span>
                      </div>
                      <p className="mt-2.5 text-[15px] leading-relaxed text-ink/60">{s.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* page FAQ */}
      <section className="py-24 lg:py-28">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <Reveal className="text-center">
            <SectionTag>Good to know</SectionTag>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em]">Common questions</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={0.06 * i}>
                <div className="h-full rounded-2xl border border-ink/10 bg-white/70 p-6">
                  <h3 className="font-display text-lg font-bold tracking-tight">{f.q}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink/60">{f.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTA />
    </main>
  );
}
