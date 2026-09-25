"use client";

import { Star } from "lucide-react";
import { Reveal, SectionTag } from "./ui";
import { cn } from "@/lib/cn";

type T = { quote: string; name: string; role: string };

const ROW_A: T[] = [
  {
    quote: "We replaced two data vendors and a virtual assistant. zybble paid for itself on the very first export.",
    name: "Maya Chen",
    role: "Founder · BrightFunnel",
  },
  {
    quote: "Cold email felt dead until our lists got this clean. 61% open rates across a 30k send. I've never seen that.",
    name: "Darius Cole",
    role: "Growth Lead · Pipeframe",
  },
  {
    quote: "The AI icebreakers are absurdly specific — it references reviews left last week. Prospects think we did homework.",
    name: "Lena Okafor",
    role: "Agency Owner · LO Media",
  },
  {
    quote: "Pulled every roofer in Texas before lunch. My CRM has never been this full, and my reps have never been this calm.",
    name: "Josh Weber",
    role: "Sales Director · Summit Exteriors",
  },
];

const ROW_B: T[] = [
  {
    quote: "Setup took four minutes. By dinner I had 5,000 verified dental contacts sitting in HubSpot.",
    name: "Priya Nair",
    role: "SDR Manager · Clinica",
  },
  {
    quote: "The phone data is the cheat code. Connect rates doubled in week one — direct dials, not front desks.",
    name: "Tom Beckett",
    role: "Founder · Outboundly",
  },
  {
    quote: "As a two-person agency, zybble is our entire list-building team. Clients think we have a research department.",
    name: "Sofia Marino",
    role: "Partner · Marino & Vale",
  },
  {
    quote: "Duplicate protection alone saved us from a territory war between reps. Worth every cent for that.",
    name: "Andre Baptiste",
    role: "VP Sales · Northline",
  },
];

const AVATAR_STYLES = [
  "bg-lime text-ink",
  "bg-forest text-lime",
  "bg-ink text-paper",
  "bg-cream text-ink border border-ink/15",
];

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-ink text-ink" />
      ))}
    </div>
  );
}

function Card({ t, i }: { t: T; i: number }) {
  const initials = t.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <figure className="w-[320px] shrink-0 rounded-2xl border border-ink/10 bg-paper p-5 sm:w-[370px] sm:p-6">
      <Stars />
      <blockquote className="mt-4 text-[0.95rem] leading-relaxed text-ink/80">“{t.quote}”</blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full font-display text-sm font-bold",
            AVATAR_STYLES[i % AVATAR_STYLES.length],
          )}
        >
          {initials}
        </span>
        <div>
          <p className="text-sm font-semibold">{t.name}</p>
          <p className="font-mono text-[11px] text-ink/50">{t.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}

export default function Testimonials() {
  return (
    <section className="overflow-hidden border-y border-ink/10 bg-cream/60 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Reveal>
              <SectionTag>Wall of love</SectionTag>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
                Pipeline builders, talking
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.16}>
            <div className="flex items-center gap-3">
              <Stars />
              <p className="font-mono text-xs text-ink/55">
                <span className="font-semibold text-ink">4.9 / 5</span> · from 2,300+ growth teams
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="mt-14 space-y-4">
        {[ROW_A, ROW_B].map((row, ri) => (
          <div
            key={ri}
            className="marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
          >
            <div
              className="marquee-track flex w-max gap-4 pr-4"
              style={{
                ["--marquee-speed" as string]: ri === 0 ? "46s" : "54s",
                animationDirection: ri === 1 ? "reverse" : "normal",
              }}
            >
              {[...row, ...row].map((t, i) => (
                <Card key={t.name + i} t={t} i={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
