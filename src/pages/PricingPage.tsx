import { Check, ShieldCheck, RotateCcw, Timer } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "../components/PageShell";
import { PricingCard } from "../components/Pricing";
import { CTA } from "../components/Footer";
import { Reveal, SectionTag } from "../components/ui";
import { cn } from "../utils/cn";

const ROWS = [
  { name: "Starter", leads: "5,000", price: "$19", perK: "$3.80", seats: "1 seat", support: "Standard" },
  { name: "Growth", leads: "15,000", price: "$39", perK: "$2.60", seats: "3 seats", support: "Standard" },
  { name: "Pro", leads: "30,000", price: "$69", perK: "$2.30", seats: "5 seats", support: "Priority", popular: true },
  { name: "Scale", leads: "50,000", price: "$99", perK: "$1.98", seats: "10 seats", support: "Priority" },
  { name: "Business", leads: "75,000", price: "$149", perK: "$1.99", seats: "15 seats", support: "Priority+" },
  { name: "Agency", leads: "100,000", price: "$199", perK: "$1.99", seats: "Unlimited", support: "Dedicated" },
];

const GUARANTEES = [
  { icon: Timer, t: "7-day free trial", d: "Every plan starts free. No card, no sales call, no strings." },
  { icon: RotateCcw, t: "Bounce refund", d: "Hard-bounced emails are refunded as credits automatically." },
  { icon: ShieldCheck, t: "Cancel in one click", d: "Self-serve cancellation. Keep every export forever." },
];

export default function PricingPage() {
  usePageMeta(
    "Pricing — zybble | Google Maps leads from $19/mo",
    "Six plans from $19/5k leads to $199/100k. Every plan includes email & phone data, CSV export, AI Assistant and Campaigns.",
  );
  return (
    <main>
      <PageHero
        tag="Pricing"
        title={
          <>
            Features never change. <Mark>Only volume does.</Mark>
          </>
        }
        sub="From $19 for 5,000 leads to $199 for 100,000 — every plan unlocks email & phone data, CSV export, the AI Assistant, and unlimited Campaigns."
      />

      {/* slider on dark band */}
      <section className="relative overflow-hidden bg-ink py-16 lg:py-20">
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,243,236,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,243,236,0.03)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_20%,black,transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-5 lg:px-8">
          <Reveal>
            <PricingCard />
          </Reveal>
        </div>
      </section>

      {/* comparison table */}
      <section className="border-b border-ink/10 py-20 lg:py-24">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <Reveal className="text-center">
            <SectionTag>Compare plans</SectionTag>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">All six, side by side</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-12 overflow-x-auto rounded-3xl border border-ink/10 bg-white/70 [-ms-overflow-style:none] [scrollbar-width:thin]">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-ink/10">
                    {["Plan", "Leads / mo", "Price", "Per 1k leads", "Seats", "Support"].map((h) => (
                      <th key={h} className="px-5 py-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.name} className={cn("border-b border-ink/[0.06] transition-colors last:border-0 hover:bg-lime/[0.08]", r.popular && "bg-lime/[0.12]")}>
                      <td className="px-5 py-4">
                        <span className="font-display text-base font-bold">{r.name}</span>
                        {r.popular && (
                          <span className="ml-2 rounded-full bg-lime px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">
                            popular
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-sm">{r.leads}</td>
                      <td className="px-5 py-4 font-mono text-sm font-semibold">{r.price}<span className="text-ink/40">/mo</span></td>
                      <td className="px-5 py-4 font-mono text-sm">{r.perK}</td>
                      <td className="px-5 py-4 font-mono text-sm">{r.seats}</td>
                      <td className="px-5 py-4 font-mono text-sm">{r.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {["Email & phone data", "CSV export", "AI Assistant", "Campaigns", "Duplicate protection", "Cancel anytime"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-sm text-ink/65">
                  <Check className="h-4 w-4 text-lime-2" strokeWidth={3} />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>

          {/* guarantees */}
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {GUARANTEES.map((g, i) => (
              <Reveal key={g.t} delay={0.07 * i}>
                <div className="flex h-full items-start gap-4 rounded-2xl border border-ink/10 bg-white/70 p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-lime">
                    <g.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-tight">{g.t}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{g.d}</p>
                  </div>
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
