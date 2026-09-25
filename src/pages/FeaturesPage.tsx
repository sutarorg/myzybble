import { Link } from "react-router-dom";
import {
  ArrowRight,
  Map,
  ScanSearch,
  BrainCircuit,
  Check,
  MapPin,
  Mail,
  Phone,
  RefreshCw,
} from "lucide-react";
import { PageHero, usePageMeta, Mark } from "../components/PageShell";
import Features from "../components/Features";
import { CTA } from "../components/Footer";
import { Reveal } from "../components/ui";
import { cn } from "../utils/cn";

const DEEP_DIVES = [
  {
    icon: Map,
    tag: "Search engine",
    title: "The map, industrialized",
    desc: "zybble's crawler understands Google Maps like a local — categories, neighborhoods, opening hours, ratings velocity. Chain hundreds of geo-queries into one run and it never repeats itself, never hits a wall, and never hands you the same business twice.",
    points: ["Chain searches across zips, cities & states", "Filters: rating, review count, category, hours", "Runs in the background — results stream in live"],
    visual: (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.05] p-5">
        {[
          { q: "roofers · denver, co", n: "3,214 found", done: true },
          { q: "roofers · aurora, co", n: "1,108 found", done: true },
          { q: "roofers · boulder, co", n: "742 found", done: false },
          { q: "roofers · fort collins, co", n: "queued", done: false },
        ].map((r) => (
          <div key={r.q} className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink px-4 py-3">
            <MapPin className={cn("h-4 w-4 shrink-0", r.done ? "text-lime" : "text-paper/30")} />
            <span className="font-mono text-xs text-paper/75">{r.q}</span>
            <span
              className={cn(
                "ml-auto rounded-full px-2.5 py-0.5 font-mono text-[10px]",
                r.done ? "bg-lime/15 text-lime" : "bg-white/10 text-paper/40",
              )}
            >
              {r.n}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: ScanSearch,
    tag: "Enrichment",
    title: "Verification you can invoice against",
    desc: "Every record passes a five-stage pipeline: crawl, match, SMTP-verify, line-type check, confidence score. If an email hard-bounces inside your campaign window, the credit comes back automatically — no ticket, no argument.",
    points: ["Real-time SMTP + pattern verification", "Mobile vs. landline detection for every number", "Automatic credit refunds for hard bounces"],
    visual: (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.05] p-5">
        {["crawl listing", "match contacts", "smtp verify", "line-type check", "confidence score"].map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold", i < 5 ? "bg-lime text-ink" : "bg-white/10 text-paper/50")}>
              {i + 1}
            </span>
            <span className="font-mono text-xs text-paper/70">{s}</span>
            <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-lime">
              <Check className="h-3 w-3" strokeWidth={3} />
              pass
            </span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-lime/10 px-3 py-2 font-mono text-[10px] text-lime">
          avg pipeline time · 1.8s per record
        </div>
      </div>
    ),
  },
  {
    icon: BrainCircuit,
    tag: "AI & campaigns",
    title: "Personalization that reads like homework",
    desc: "The AI Assistant studies each business — recent reviews, rating, niche, neighborhood — and writes openers nobody believes are automated. Launch full sequences with follow-ups, reply detection, and instant pause the moment a human answers.",
    points: ["Review-aware icebreakers per business", "Multichannel sequences with auto follow-ups", "Reply detection stops the sequence instantly"],
    visual: (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.05] p-5">
        <div className="rounded-xl border border-white/10 bg-ink p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] text-paper/40">
            <Mail className="h-3 w-3 text-lime" />
            ai assistant · drafting
            <span className="caret ml-0.5 h-3 w-px bg-lime" />
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-paper/85">
            “Hi Dana — 212 reviews at 4.9★ for Peak Roofing is rare in Denver. We help roofers turn review
            momentum into booked inspections…”
          </p>
          <button className="mt-3 flex items-center gap-1.5 rounded-full border border-lime/30 px-2.5 py-1 font-mono text-[10px] text-lime">
            <RefreshCw className="h-3 w-3" /> regenerate
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-lime/10 px-3.5 py-2.5 font-mono text-[10px] text-lime">
          <Phone className="h-3 w-3" /> sequence: email → follow-up → call task
        </div>
      </div>
    ),
  },
];

const INTEGRATIONS = ["HubSpot", "Pipedrive", "Salesforce", "Clay", "Instantly", "Smartlead", "Zapier", "Make", "Airtable", "Google Sheets", "Webhooks", "REST API"];

export default function FeaturesPage() {
  usePageMeta(
    "Features — zybble | Google Maps lead generation",
    "Search Google Maps at scale, verify emails & phones, and launch AI-personalized campaigns. Explore every zybble feature.",
  );
  return (
    <main>
      <PageHero
        tag="Features"
        title={
          <>
            Everything between the <Mark>map</Mark> and the deal
          </>
        }
        sub="zybble covers the full loop — discovery, enrichment, outreach, export — so your stack stays lean and your pipeline stays full."
      >
        <Link
          to="/signup"
          className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-semibold text-paper transition-all hover:bg-ink-3"
        >
          Try it free
          <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </PageHero>

      {/* full bento from landing */}
      <div className="-mt-6">
        <Features />
      </div>

      {/* deep dives */}
      <section className="bg-ink py-24 text-paper lg:py-32">
        <div className="mx-auto max-w-6xl space-y-20 px-5 lg:px-8">
          {DEEP_DIVES.map((d, i) => (
            <Reveal key={d.tag}>
              <div className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-lime">
                    <d.icon className="h-3.5 w-3.5" />
                    {d.tag}
                  </span>
                  <h3 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">{d.title}</h3>
                  <p className="mt-4 leading-relaxed text-paper/55">{d.desc}</p>
                  <ul className="mt-6 space-y-3">
                    {d.points.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-[15px] text-paper/80">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime/15">
                          <Check className="h-3 w-3 text-lime" strokeWidth={3} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl border border-white/10 bg-ink-2/60 p-4 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)]">
                  {d.visual}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* integrations */}
      <section className="border-b border-ink/10 py-20">
        <div className="mx-auto max-w-6xl px-5 text-center lg:px-8">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/45">Plays nicely with your stack</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5">
              {INTEGRATIONS.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-ink/15 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink/75 transition-all hover:border-ink hover:bg-ink hover:text-paper"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <CTA />
    </main>
  );
}
