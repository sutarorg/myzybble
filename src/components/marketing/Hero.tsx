"use client";

import { useEffect, useState } from "react";
import Link from "@/components/marketing/LinkCompat";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useMotionTemplate,
} from "framer-motion";
import {
  ArrowRight,
  Play,
  Check,
  MapPin,
  Mail,
  Phone,
  FileDown,
  Sparkles,
  Search,
  TrendingDown,
} from "lucide-react";
import { EASE } from "./ui";

const LEADS = [
  {
    name: "Riverside Dental Co.",
    cat: "Dentist · Austin, TX",
    email: "hello@riversidedental.com",
    phone: "+1 (512) 555-0148",
  },
  {
    name: "Peak Roofing LLC",
    cat: "Roofer · Denver, CO",
    email: "office@peakroofing.co",
    phone: "+1 (303) 555-0127",
  },
  {
    name: "Barre & Bloom Studio",
    cat: "Fitness · Portland, OR",
    email: "hi@barreandbloom.com",
    phone: "+1 (503) 555-0119",
  },
  {
    name: "Casa Verde Landscaping",
    cat: "Landscaper · Phoenix, AZ",
    email: "team@casaverde.io",
    phone: "+1 (602) 555-0163",
  },
];

const PINS = [
  { x: "16%", y: "26%", d: 0 },
  { x: "71%", y: "20%", d: 0.9 },
  { x: "28%", y: "66%", d: 1.7 },
  { x: "82%", y: "58%", d: 2.3 },
  { x: "52%", y: "82%", d: 3.1 },
  { x: "60%", y: "34%", d: 3.7 },
];

/* ------------------------------------------------------------------ */
/*  Animated product visual: map scan + lead extraction               */
/* ------------------------------------------------------------------ */
function MapRadar() {
  const [leadIdx, setLeadIdx] = useState(0);
  const [count, setCount] = useState(12483);

  useEffect(() => {
    const t = setInterval(() => setLeadIdx((i) => (i + 1) % LEADS.length), 2800);
    const c = setInterval(() => setCount((n) => n + Math.floor(Math.random() * 14) + 3), 1400);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, []);

  const lead = LEADS[leadIdx];
  const initials = lead.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="relative">
      {/* outer glow */}
      <div className="absolute -inset-6 rounded-[2.5rem] bg-lime/25 blur-3xl" aria-hidden />

      <div className="relative overflow-hidden rounded-[1.6rem] border border-ink/20 bg-ink text-paper shadow-[0_40px_90px_-20px_rgba(11,16,14,0.55)]">
        {/* app chrome / search bar */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5 sm:px-4">
          <div className="hidden gap-1.5 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-lime/50" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-lime" />
            <span className="truncate font-mono text-[11px] text-paper/80 sm:text-xs">
              roofers · denver, co
            </span>
            <span className="caret ml-0.5 hidden h-3.5 w-px bg-lime sm:block" />
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 font-mono text-[11px] font-semibold text-ink">
            <Search className="h-3 w-3" />
            Search
          </span>
        </div>

        {/* map area */}
        <div className="relative h-[380px] sm:h-[430px] lg:h-[460px]">
          {/* grid */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <pattern id="mapgrid" width="38" height="38" patternUnits="userSpaceOnUse">
                <path d="M38 0H0V38" fill="none" stroke="rgba(245,243,236,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapgrid)" />
          </svg>

          {/* roads */}
          <div className="absolute -left-[10%] top-[38%] h-1.5 w-[80%] -rotate-[16deg] rounded-full bg-white/[0.05]" />
          <div className="absolute -right-[12%] top-[64%] h-1 w-[70%] rotate-[12deg] rounded-full bg-white/[0.05]" />
          <div className="absolute left-[58%] -top-[10%] h-[70%] w-1 rotate-[24deg] rounded-full bg-white/[0.04]" />

          {/* dashed route */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 760 500" preserveAspectRatio="none" aria-hidden>
            <path
              className="route-line"
              d="M -20 420 C 140 380, 180 180, 340 200 S 560 380, 780 180"
              fill="none"
              stroke="rgba(216,255,62,0.35)"
              strokeWidth="2"
              strokeDasharray="2 10"
              strokeLinecap="round"
            />
          </svg>

          {/* radar sweep */}
          <div className="absolute" style={{ left: "42%", top: "52%" }}>
            <div
              className="sweep h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-80 sm:w-80"
              style={{
                background: "conic-gradient(from 0deg, rgba(216,255,62,0.28), transparent 22%)",
                maskImage: "radial-gradient(circle, black, transparent 68%)",
                WebkitMaskImage: "radial-gradient(circle, black, transparent 68%)",
              }}
            />
          </div>

          {/* center pin with ping rings */}
          <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: "42%", top: "52%" }}>
            <span className="ping-ring absolute inset-0 -m-5 rounded-full border-2 border-lime/60" />
            <span
              className="ping-ring absolute inset-0 -m-5 rounded-full border-2 border-lime/40"
              style={{ animationDelay: "0.8s" }}
            />
            <span
              className="ping-ring absolute inset-0 -m-5 rounded-full border border-lime/30"
              style={{ animationDelay: "1.6s" }}
            />
            <div className="relative grid h-10 w-10 place-items-center rounded-full border-2 border-lime bg-ink shadow-[0_0_30px_rgba(216,255,62,0.5)]">
              <MapPin className="h-5 w-5 text-lime" fill="rgba(216,255,62,0.25)" />
            </div>
          </div>

          {/* satellite pins popping */}
          {PINS.map((p) => (
            <motion.div
              key={p.x + p.y}
              className="absolute"
              style={{ left: p.x, top: p.y }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], opacity: [0, 1, 1] }}
              transition={{ duration: 0.55, delay: p.d, repeat: Infinity, repeatDelay: 4.6, ease: EASE }}
            >
              <MapPin
                className="h-5 w-5 -translate-x-1/2 -translate-y-[90%] text-lime drop-shadow-[0_0_8px_rgba(216,255,62,0.6)]"
                fill="rgba(216,255,62,0.3)"
              />
            </motion.div>
          ))}

          {/* verified chip */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-lime/25 bg-ink/80 px-2.5 py-1 font-mono text-[10px] text-lime backdrop-blur sm:left-4 sm:top-4">
            <Check className="h-3 w-3" />
            98.2% verified
          </div>

          {/* cycling lead card */}
          <div className="absolute right-3 top-10 w-[13.5rem] sm:right-4 sm:top-12 sm:w-60">
            <AnimatePresence mode="wait">
              <motion.div
                key={leadIdx}
                initial={{ y: 16, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -12, opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="rounded-xl border border-white/15 bg-ink-2/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime font-display text-xs font-bold text-ink">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-paper">{lead.name}</p>
                    <p className="truncate font-mono text-[10px] text-paper/50">{lead.cat}</p>
                  </div>
                </div>
                <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
                  <p className="flex items-center gap-1.5 truncate font-mono text-[10px] text-paper/70">
                    <Mail className="h-3 w-3 shrink-0 text-lime/80" />
                    {lead.email}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] text-paper/70">
                    <Phone className="h-3 w-3 shrink-0 text-lime/80" />
                    {lead.phone}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-lime/10 px-2 py-1 font-mono text-[9.5px] text-lime">
                  <Check className="h-3 w-3" />
                  Added to campaign · Roofers Q3
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* leads counter */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2.5 rounded-full border border-white/15 bg-ink/85 py-1.5 pl-2 pr-3 backdrop-blur sm:bottom-4 sm:left-4">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-lime">
              <Sparkles className="h-3 w-3 text-ink" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-paper/50">leads found</p>
              <p className="font-mono text-sm font-semibold leading-none text-lime">
                {count.toLocaleString("en-US")}
              </p>
            </div>
          </div>

          {/* csv chip */}
          <div className="absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-full border border-white/15 bg-ink/85 px-3 py-1.5 font-mono text-[10px] text-paper/70 backdrop-blur sm:bottom-4 sm:right-4 sm:flex">
            <FileDown className="h-3 w-3 text-lime" />
            export.csv · 5,000 rows
          </div>
        </div>
      </div>

      {/* floating satellite chips */}
      <motion.div
        initial={{ opacity: 0, y: 20, rotate: 4 }}
        animate={{ opacity: 1, y: 0, rotate: 3 }}
        transition={{ delay: 0.9, duration: 0.8, ease: EASE }}
        className="float-soft absolute -right-2 -top-5 hidden items-center gap-2 rounded-full border border-ink/10 bg-paper px-4 py-2.5 shadow-[0_16px_40px_rgba(11,16,14,0.18)] md:flex lg:-right-6"
      >
        <Sparkles className="h-4 w-4 text-ink" />
        <span className="font-mono text-xs font-semibold text-ink">AI Assistant: ON</span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ delay: 1.05, duration: 0.8, ease: EASE }}
        className="float-soft absolute -bottom-5 -left-2 hidden items-center gap-2 rounded-full border border-ink/10 bg-ink px-4 py-2.5 shadow-[0_16px_40px_rgba(11,16,14,0.35)] md:flex lg:-left-8"
        style={{ animationDelay: "1.2s" }}
      >
        <TrendingDown className="h-4 w-4 text-lime" />
        <span className="font-mono text-xs font-semibold text-paper">
          cost per lead <span className="text-lime">$0.002</span>
        </span>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero section                                                      */
/* ------------------------------------------------------------------ */
export default function Hero() {
  const mx = useMotionValue(600);
  const my = useMotionValue(200);
  const sx = useSpring(mx, { stiffness: 50, damping: 20 });
  const sy = useSpring(my, { stiffness: 50, damping: 20 });
  const glow = useMotionTemplate`radial-gradient(560px circle at ${sx}px ${sy}px, rgba(216,255,62,0.14), transparent 70%)`;

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-28 sm:pt-32 lg:pt-40"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
    >
      {/* background grid + glow */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(11,16,14,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(11,16,14,0.045)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black,transparent)]"
        aria-hidden
      />
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: glow }} aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-8">
          {/* copy */}
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/60 py-1.5 pl-2 pr-4 text-xs font-medium text-ink/75 backdrop-blur">
                <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                  New
                </span>
                AI outreach assistant now in every plan
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
              className="mt-6 font-display text-[2.7rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.1rem] xl:text-[4.5rem]"
            >
              Turn{" "}
              <span className="relative inline-block whitespace-nowrap">
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.65, ease: EASE }}
                  className="absolute inset-x-[-0.12em] bottom-[0.02em] top-[0.52em] -rotate-1 rounded-[0.15em] bg-lime origin-left"
                  aria-hidden
                />
                <span className="relative">Google Maps</span>
              </span>{" "}
              into a pipeline of verified leads.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-ink/65"
            >
              Search any niche in any city. zybble extracts businesses, verifies their{" "}
              <span className="font-semibold text-ink">emails & phone numbers</span>, and hands you a clean
              CSV — or lets the AI run the outreach for you.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                to="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-[0.95rem] font-semibold text-paper transition-all duration-300 hover:bg-ink-3 hover:shadow-[0_16px_44px_rgba(11,16,14,0.28)]"
              >
                Start generating leads — free
                <ArrowRight className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/how-it-works"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full border border-ink/15 px-7 py-4 text-[0.95rem] font-semibold text-ink transition-colors hover:border-ink/35"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-lime">
                  <Play className="h-3 w-3 fill-ink text-ink" />
                </span>
                See how it works
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-ink/50"
            >
              {["100 free leads", "No credit card", "Cancel anytime"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-lime-2" strokeWidth={3} />
                  {t}
                </span>
              ))}
            </motion.div>

            {/* stats */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
              className="mt-10 grid grid-cols-3 divide-x divide-ink/10 border-t border-ink/10 pt-6"
            >
              {[
                { v: "12M+", l: "Businesses indexed" },
                { v: "98.2%", l: "Avg. verify rate" },
                { v: "2,300+", l: "Teams onboard" },
              ].map((s) => (
                <div key={s.l} className="px-4 first:pl-0 last:pr-0">
                  <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{s.v}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink/50 sm:text-[11px]">
                    {s.l}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* visual */}
          <motion.div
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
            className="lg:col-span-6 lg:pl-4"
          >
            <MapRadar />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
