import type { ReactNode } from "react";
import {
  Map,
  MailCheck,
  PhoneCall,
  Sparkles,
  Send,
  FileDown,
  Check,
  ArrowRight,
  RefreshCw,
  MessageSquareReply,
} from "lucide-react";
import { Reveal, SectionTag } from "./ui";
import { cn } from "../utils/cn";

function Card({
  icon,
  title,
  desc,
  children,
  className,
  delay = 0,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  children?: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <div className="group flex h-full flex-col rounded-3xl border border-ink/10 bg-white/70 p-6 transition-all duration-500 hover:-translate-y-1.5 hover:border-ink/20 hover:shadow-[0_24px_60px_-20px_rgba(11,16,14,0.22)] sm:p-7">
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-lime transition-transform duration-500 group-hover:-rotate-6">
            {icon}
          </span>
          <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
        </div>
        <p className="mt-3.5 text-[0.95rem] leading-relaxed text-ink/60">{desc}</p>
        {children && <div className="mt-auto pt-6">{children}</div>}
      </div>
    </Reveal>
  );
}

const QUERY_CHIPS = ["dentists · leeds", "hvac · phoenix", "gyms · toronto", "law firms · chicago"];

export default function Features() {
  return (
    <section id="features" className="relative scroll-mt-28 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <SectionTag>Features</SectionTag>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              Everything between the map and the deal
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 text-lg text-ink/60">
              One workflow: find businesses, enrich contacts, launch outreach. No duct-taped tools, no
              stale databases.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          {/* 1 — search at scale (wide) */}
          <Card
            className="lg:col-span-4"
            icon={<Map className="h-5 w-5" />}
            title="Search Google Maps at scale"
            desc="Niche + city in — thousands of real businesses out. Chain searches across neighborhoods and zip codes automatically, with ratings, categories, and hours attached."
          >
            <div className="rounded-2xl border border-ink/10 bg-paper p-4">
              <div className="flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5">
                <Map className="h-4 w-4 text-ink/40" />
                <span className="font-mono text-sm text-ink/80">roofers · denver, co</span>
                <span className="caret h-4 w-px bg-ink/70" />
                <span className="ml-auto rounded-full bg-lime px-3 py-1 font-mono text-[11px] font-bold text-ink">
                  3,214 found
                </span>
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">chains next:</span>
                {QUERY_CHIPS.map((q, i) => (
                  <span
                    key={q}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px]",
                      i % 2 === 0 ? "border-ink/15 text-ink/60" : "border-ink/15 bg-ink text-paper",
                    )}
                  >
                    {q}
                    {i < QUERY_CHIPS.length - 1 && <ArrowRight className="h-3 w-3 opacity-50" />}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* 2 — verified emails */}
          <Card
            className="lg:col-span-2"
            icon={<MailCheck className="h-5 w-5" />}
            title="Emails, verified live"
            desc="Every address passes real-time SMTP + pattern checks before it costs you a credit. Under 2% bounce, or it's refunded."
            delay={0.08}
          >
            <div className="space-y-2">
              {["amy@peakroofing.co", "info@barrebloom.com", "j.miller@casaveg.io"].map((e) => (
                <div
                  key={e}
                  className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-paper px-3 py-2"
                >
                  <span className="truncate font-mono text-[11px] text-ink/70">{e}</span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold text-forest">
                    <Check className="h-3 w-3" strokeWidth={3} />
                    verified
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* 3 — phone data */}
          <Card
            className="lg:col-span-2"
            icon={<PhoneCall className="h-5 w-5" />}
            title="Direct phone numbers"
            desc="Owner mobiles, front desks, and direct dials — labeled by line type and confidence score."
            delay={0.12}
          >
            <div className="space-y-2">
              {[
                { n: "+1 (303) 555-0127", t: "MOBILE" },
                { n: "+1 (512) 555-0148", t: "LANDLINE" },
                { n: "+1 (503) 555-0119", t: "MOBILE" },
              ].map((p) => (
                <div
                  key={p.n}
                  className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-paper px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-ink/70">{p.n}</span>
                  <span className="shrink-0 rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-ink/60">
                    {p.t}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* 4 — AI assistant */}
          <Card
            className="lg:col-span-2"
            icon={<Sparkles className="h-5 w-5" />}
            title="AI Assistant"
            desc="One click writes hyper-specific icebreakers, subject lines, and full sequences — referencing reviews, niche, and city."
            delay={0.16}
          >
            <div className="rounded-xl border border-ink/10 bg-ink p-3.5 text-paper">
              <p className="text-[11.5px] leading-relaxed text-paper/85">
                “Hi Dana — 4.9★ across 212 reviews for Peak Roofing is rare in Denver. Quick question…”
              </p>
              <button className="mt-3 flex items-center gap-1.5 rounded-full border border-lime/30 px-2.5 py-1 font-mono text-[10px] text-lime transition-colors hover:bg-lime/10">
                <RefreshCw className="h-3 w-3" />
                regenerate
              </button>
            </div>
          </Card>

          {/* 5 — campaigns */}
          <Card
            className="lg:col-span-2"
            icon={<Send className="h-5 w-5" />}
            title="Campaigns that follow up"
            desc="Launch multichannel sequences with auto follow-ups, reply detection, and instant pause on response."
            delay={0.2}
          >
            <div className="rounded-xl border border-ink/10 bg-paper p-3.5">
              {[
                { d: "Day 0", t: "Email · intro" },
                { d: "Day 2", t: "Follow-up · value" },
                { d: "Day 5", t: "Call task" },
              ].map((s, i) => (
                <div key={s.d} className="flex items-center gap-3 py-1.5">
                  <span className="relative flex flex-col items-center">
                    <span className={cn("h-2.5 w-2.5 rounded-full", i === 0 ? "bg-lime-2" : "bg-ink/20")} />
                    {i < 2 && <span className="absolute top-2.5 h-4 w-px bg-ink/15" />}
                  </span>
                  <span className="font-mono text-[10px] text-ink/45">{s.d}</span>
                  <span className="text-xs font-medium text-ink/75">{s.t}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-lime px-2.5 py-1.5 font-mono text-[10px] font-bold text-ink">
                <MessageSquareReply className="h-3 w-3" />
                3 new replies today
              </div>
            </div>
          </Card>

          {/* 6 — CSV export (wide) */}
          <Card
            className="lg:col-span-4"
            icon={<FileDown className="h-5 w-5" />}
            title="Clean CSV exports & CRM sync"
            desc="UTF-8, deduped, column-perfect CSVs that any tool ingests — or one-click push straight into your stack."
            delay={0.24}
          >
            <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-forest text-lime">
                  <FileDown className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-mono text-sm font-semibold text-ink">denver-roofers-q3.csv</p>
                  <p className="font-mono text-[10.5px] text-ink/45">5,000 rows · 18 columns · 0 dups</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {["HubSpot", "Pipedrive", "Salesforce", "Clay"].map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-ink/15 bg-white px-3.5 py-1.5 font-mono text-[11px] font-medium text-ink/70"
                  >
                    {c}
                  </span>
                ))}
                <span className="rounded-full bg-lime px-3.5 py-1.5 font-mono text-[11px] font-bold text-ink">
                  1-click push
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
