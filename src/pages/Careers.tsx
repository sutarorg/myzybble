import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, MapPin, Clock3, Globe2, HeartPulse, Plane, Laptop, GraduationCap, Banknote, Baby, Sparkles } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "../components/PageShell";
import { Reveal, EASE } from "../components/ui";
import { cn } from "../utils/cn";

const PERKS = [
  { icon: Globe2, t: "Remote-first", d: "Work from anywhere with ±4h overlap. Annual offsite in a city we've never scraped." },
  { icon: Banknote, t: "Top-of-market pay", d: "Salary benchmarked to the 75th percentile, refreshed twice a year. Everyone gets equity." },
  { icon: HeartPulse, t: "Full health cover", d: "Medical, dental, vision for you and dependents — plus a monthly wellness stipend." },
  { icon: Plane, t: "5 weeks PTO", d: "Minimum, not maximum. We track under-vacationing, not over." },
  { icon: Laptop, t: "$2,500 setup", d: "The laptop, monitor, chair and headphones you actually want. Refresh every 2 years." },
  { icon: GraduationCap, t: "$2,000 learning", d: "Courses, conferences, books. Present back to the team and it's doubled." },
  { icon: Baby, t: "16 weeks parental", d: "Fully paid, all parents, plus a phased return. No tenure requirement." },
  { icon: Sparkles, t: "Dogfooding budget", d: "Run your own micro-agency experiment on zybble credits. Seriously." },
];

const ROLES = [
  { id: "r1", dept: "Engineering", title: "Senior Product Engineer (React)", loc: "Remote · EU/US", type: "Full-time", d: "Own the campaign builder end-to-end. You sweat pixels and query plans equally." },
  { id: "r2", dept: "Engineering", title: "Data Infrastructure Engineer", loc: "Remote · EU", type: "Full-time", d: "Keep 12M+ records fresh. Crawl orchestration, verification pipelines, lots of queues." },
  { id: "r3", dept: "Engineering", title: "ML Engineer, Personalization", loc: "Remote · US", type: "Full-time", d: "Teach the AI Assistant to write openers humans can't spot. Evals > vibes." },
  { id: "r4", dept: "Design", title: "Product Designer", loc: "Remote · EU/US", type: "Full-time", d: "Turn dense data workflows into interfaces that feel like magic tricks." },
  { id: "r5", dept: "Growth", title: "Growth Marketer, Content & SEO", loc: "Remote · US", type: "Full-time", d: "Own the blog, the playbooks, and the leads they generate. You'll use zybble to grow zybble." },
  { id: "r6", dept: "Growth", title: "Partnerships Lead, CRMs", loc: "Remote · US", type: "Full-time", d: "HubSpot, Pipedrive, Salesforce, Clay — turn integrations into distribution." },
  { id: "r7", dept: "Operations", title: "Customer Success Engineer", loc: "Remote · EU", type: "Full-time", d: "Help agencies hit 9% reply rates. Half support, half outbound strategist." },
  { id: "r8", dept: "Data", title: "Data Quality Analyst", loc: "Remote · Anywhere", type: "Contract", d: "Audit verification pipelines and hunt the edge cases that cause bounces." },
];

const DEPTS = ["All", ...Array.from(new Set(ROLES.map((r) => r.dept)))];

export default function Careers() {
  usePageMeta(
    "Careers — zybble | Join the team",
    "We're hiring engineers, designers and growth people to build the Google Maps lead engine. Remote-first, top-of-market pay.",
  );
  const [dept, setDept] = useState("All");
  const roles = dept === "All" ? ROLES : ROLES.filter((r) => r.dept === dept);

  return (
    <main>
      <PageHero
        tag="Careers"
        title={
          <>
            Build the engine behind <Mark>2,300+ pipelines</Mark>
          </>
        }
        sub="We're 24 people across 9 countries, profitable, and shipping weekly. Small team, unfair leverage, real ownership."
      >
        <div className="flex flex-wrap gap-2 font-mono text-xs text-ink/55">
          <span className="rounded-full border border-ink/15 bg-white/70 px-4 py-2">{ROLES.length} open roles</span>
          <span className="rounded-full border border-ink/15 bg-white/70 px-4 py-2">remote-first</span>
          <span className="rounded-full border border-ink/15 bg-white/70 px-4 py-2">profitable</span>
        </div>
      </PageHero>

      {/* perks */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal>
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">The deal</h2>
          </Reveal>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((p, i) => (
              <Reveal key={p.t} delay={0.04 * i}>
                <div className="group h-full rounded-3xl border border-ink/10 bg-white/70 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-ink/25">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-lime transition-transform duration-500 group-hover:-rotate-6">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* roles */}
      <section className="border-y border-ink/10 bg-cream/50 py-20 lg:py-24">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Open roles</h2>
            <div className="flex flex-wrap gap-2">
              {DEPTS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDept(d)}
                  className={cn(
                    "rounded-full border px-4.5 py-2.5 text-sm font-semibold transition-all",
                    dept === d
                      ? "border-ink bg-ink text-paper shadow-[0_10px_26px_rgba(11,16,14,0.22)]"
                      : "border-ink/15 bg-white/70 text-ink/60 hover:border-ink/40 hover:text-ink",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Reveal>

          <div className="mt-10 space-y-3">
            <AnimatePresence mode="popLayout">
              {roles.map((r) => (
                <motion.div
                  layout
                  key={r.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <Link
                    to="/contact"
                    className="group flex flex-col gap-4 rounded-2xl border border-ink/10 bg-paper p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_20px_50px_-18px_rgba(11,16,14,0.2)] sm:flex-row sm:items-center"
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-display text-xl font-bold tracking-tight">{r.title}</h3>
                        <span className="rounded-full bg-lime px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-ink">
                          {r.dept}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-ink/60">{r.d}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink/45">
                        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{r.loc}</span>
                        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{r.type}</span>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-shadow group-hover:shadow-[0_12px_30px_rgba(11,16,14,0.35)]">
                      Apply
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <Reveal className="mt-10">
            <div className="flex flex-col items-center justify-between gap-4 rounded-3xl bg-ink p-7 text-paper sm:flex-row sm:p-8">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight">Don't see your role?</h3>
                <p className="mt-1.5 text-sm text-paper/60">
                  If you can move the needle on pipeline — yours and ours — we want the email anyway.
                </p>
              </div>
              <Link to="/contact" className="shrink-0 rounded-full bg-lime px-7 py-3.5 text-sm font-bold text-ink transition-shadow hover:shadow-[0_0_36px_rgba(216,255,62,0.5)]">
                Pitch yourself
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
