import { Link } from "react-router-dom";
import { Search, ShieldCheck, Rocket, ArrowRight } from "lucide-react";
import { Reveal, SectionTag } from "./ui";

const STEPS = [
  {
    n: "01",
    icon: Search,
    time: "~30 seconds",
    title: "Search a niche + city",
    desc: "Type “roofers in Denver”. zybble crawls every listing on the map — ratings, categories, hours, websites — and chains across neighborhoods automatically.",
    visual: (
      <div className="mt-6 flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2.5">
        <Search className="h-4 w-4 text-lime" />
        <span className="font-mono text-xs text-paper/80">dentists · austin, tx</span>
        <span className="caret h-4 w-px bg-lime" />
        <span className="ml-auto font-mono text-[10px] text-paper/40">16 zips queued</span>
      </div>
    ),
  },
  {
    n: "02",
    icon: ShieldCheck,
    time: "~2 minutes",
    title: "Enrich & verify everything",
    desc: "Each business is matched with verified emails, direct dials, socials, and tech stack. Confidence-scored in real time — you never pay for a bounce.",
    visual: (
      <div className="mt-6 space-y-2.5 rounded-2xl border border-white/15 bg-white/[0.05] p-4">
        {[
          { l: "emails verified", v: 96 },
          { l: "phones matched", v: 88 },
          { l: "owners found", v: 71 },
        ].map((r) => (
          <div key={r.l}>
            <div className="flex justify-between font-mono text-[10px] text-paper/55">
              <span>{r.l}</span>
              <span className="text-lime">{r.v}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-lime" style={{ width: `${r.v}%` }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: "03",
    icon: Rocket,
    time: "~5 minutes",
    title: "Export or launch outreach",
    desc: "Download a column-perfect CSV in one click — or let the AI Assistant write and send personalized campaigns with automatic follow-ups.",
    visual: (
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-lime/25 bg-lime/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-lime opacity-70" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-lime" />
          </span>
          <span className="font-mono text-xs font-semibold text-lime">campaign live</span>
        </div>
        <span className="font-mono text-[10px] text-paper/50">5,000 queued · 3 replies</span>
      </div>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-16 overflow-hidden bg-ink py-24 text-paper lg:py-32">
      {/* faint grid */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,243,236,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,243,236,0.035)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        aria-hidden
      />
      <div className="absolute -top-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-lime/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <SectionTag variant="dark">How it works</SectionTag>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              From map to pipeline in three moves
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 text-lg text-paper/55">
              No setup, no scraping scripts, no proxy headaches. Your first verified list lands in under
              ten minutes.
            </p>
          </Reveal>
        </div>

        <div className="relative mt-16 grid gap-4 lg:grid-cols-3 lg:gap-5">
          {/* connector */}
          <div
            className="absolute left-[16%] right-[16%] top-14 hidden border-t-2 border-dashed border-white/15 lg:block"
            aria-hidden
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={0.1 * i}>
              <div className="relative h-full rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur transition-colors duration-500 hover:border-lime/30">
                <div className="flex items-start justify-between">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-lime/30 bg-ink text-lime">
                    <s.icon className="h-6 w-6" />
                  </span>
                  <span className="font-display text-5xl font-bold text-white/[0.08]">{s.n}</span>
                </div>
                <h3 className="mt-6 font-display text-[1.45rem] font-bold tracking-tight">{s.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-paper/55">{s.desc}</p>
                {s.visual}
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/35">
                  average time · <span className="text-lime">{s.time}</span>
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className="mt-12 text-center">
          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 rounded-full border border-lime/40 px-6 py-3 text-sm font-semibold text-lime transition-all hover:bg-lime hover:text-ink"
          >
            Run your first search
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
