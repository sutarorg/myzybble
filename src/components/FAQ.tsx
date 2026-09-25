import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageCircle } from "lucide-react";
import { Reveal, SectionTag, EASE } from "./ui";
import { cn } from "../utils/cn";

const FAQS = [
  {
    q: "Where does zybble get its data?",
    a: "We crawl public Google Maps listings at scale, then enrich every business with contact data from licensed B2B sources and the open web. Each record is re-verified on a rolling 30-day cycle, so you're never working from a stale database.",
  },
  {
    q: "How accurate are the emails and phone numbers?",
    a: "Every email passes real-time SMTP and pattern verification before you're charged a credit — our average deliverability is 98.2%, and hard bounces are automatically refunded. Phone numbers are line-type checked (mobile vs. landline) and confidence-scored.",
  },
  {
    q: "Do all plans really include the AI Assistant and Campaigns?",
    a: "Yes. Every paid plan — from $19 to $199 — includes verified email & phone data, CSV export, the AI Assistant, and unlimited Campaigns with follow-ups. The only thing that changes between plans is monthly lead volume.",
  },
  {
    q: "What exactly counts as one lead?",
    a: "One unique enriched business. Duplicates never count twice, re-verifying an existing record is free, and any hard-bounced contact is credited back instantly. Unused leads don't roll over, but you can change tiers any time.",
  },
  {
    q: "Can I export to my CRM or outbound stack?",
    a: "Absolutely. One click generates a column-perfect UTF-8 CSV, and native pushes are available for HubSpot, Pipedrive, Salesforce, and Clay. Webhooks and the API are open on every plan too.",
  },
  {
    q: "Is zybble GDPR and CAN-SPAM compliant?",
    a: "zybble processes B2B contact data under legitimate-interest grounds, provides automatic unsubscribe handling and suppression lists in every campaign, and offers a DPA on request. You stay in control of who you contact and why.",
  },
];

function Item({ q, a, open, onClick, i }: { q: string; a: string; open: boolean; onClick: () => void; i: number }) {
  return (
    <Reveal delay={0.05 * i}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border transition-all duration-300",
          open ? "border-ink/25 bg-white shadow-[0_18px_50px_-18px_rgba(11,16,14,0.18)]" : "border-ink/10 bg-white/60 hover:border-ink/20",
        )}
      >
        <button
          onClick={onClick}
          className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-7"
          aria-expanded={open}
        >
          <span className="font-mono text-xs text-ink/35">{String(i + 1).padStart(2, "0")}</span>
          <span className="flex-1 font-display text-lg font-bold tracking-tight sm:text-xl">{q}</span>
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors",
              open ? "border-lime bg-lime text-ink" : "border-ink/15 text-ink/50",
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="px-5 pb-6 pl-[3.25rem] pr-8 leading-relaxed text-ink/65 sm:px-7 sm:pl-[4.25rem]">
                {a}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-28 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <SectionTag>FAQ</SectionTag>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
                Asked before you ask
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-4 text-lg text-ink/60">
                Everything about data quality, credits, and compliance. Something missing?
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <a
                href="#cta"
                className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-ink/15 px-6 py-3.5 text-sm font-semibold transition-colors hover:border-ink/40"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-lime">
                  <MessageCircle className="h-3.5 w-3.5 text-ink" />
                </span>
                Chat with a human
              </a>
            </Reveal>
          </div>
          <div className="space-y-3 lg:col-span-7">
            {FAQS.map((f, i) => (
              <Item key={f.q} q={f.q} a={f.a} i={i} open={open === i} onClick={() => setOpen(open === i ? -1 : i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
