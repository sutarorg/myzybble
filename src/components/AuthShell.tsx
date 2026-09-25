import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, MapPin } from "lucide-react";
import { Logo, EASE } from "./ui";
import { usePageMeta } from "./PageShell";

const QUOTES = [
  {
    text: "zybble replaced two data vendors and a VA. It paid for itself on the first export.",
    by: "Maya Chen · Founder, BrightFunnel",
  },
  {
    text: "61% open rates across a 30k send. I've literally never seen list quality like this.",
    by: "Darius Cole · Growth Lead, Pipeframe",
  },
  {
    text: "The phone data is the cheat code. Connect rates doubled in the first week.",
    by: "Tom Beckett · Founder, Outboundly",
  },
];

function Panel() {
  const [q, setQ] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQ((i) => (i + 1) % QUOTES.length), 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-ink px-10 py-9 text-paper lg:flex lg:h-full xl:px-12">
      {/* bg */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,243,236,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,243,236,0.045)_1px,transparent_1px)] bg-[size:44px_44px]"
        aria-hidden
      />
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-lime/15 blur-3xl" aria-hidden />
      {[["74%", "18%"], ["16%", "30%"], ["60%", "60%"], ["28%", "68%"]].map(([x, y], i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: x, top: y }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 0.5, delay: 1 + i * 0.8, repeat: Infinity, repeatDelay: 5, ease: EASE }}
          aria-hidden
        >
          <MapPin className="h-5 w-5 -translate-x-1/2 -translate-y-[90%] text-lime/70" fill="rgba(216,255,62,0.2)" />
        </motion.div>
      ))}

      <div className="relative">
        <Logo />
        <h2 className="mt-10 max-w-md font-display text-[2rem] font-bold leading-[1.12] tracking-tight xl:text-[2.5rem]">
          Your next customer is already{" "}
          <span className="mx-0.5 inline-block -rotate-1 rounded-lg bg-lime px-2.5 py-0.5 text-ink shadow-[0_0_36px_rgba(216,255,62,0.35)] [box-decoration-break:clone]">
            on the map
          </span>
          .
        </h2>
        <ul className="mt-7 space-y-2.5">
          {[
            "Verified emails & direct dials on 12M+ businesses",
            "AI Assistant writes every first touch",
            "Clean CSVs in one click — from $19/mo",
          ].map((t) => (
            <li key={t} className="flex items-start gap-3 text-sm text-paper/70">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime/15">
                <Check className="h-3 w-3 text-lime" strokeWidth={3} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* rotating quote */}
      <div className="relative">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
          <div className="flex gap-1 text-sm text-lime">★★★★★</div>
          <div className="relative mt-2.5 min-h-[3.75rem]">
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={q}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <p className="text-sm leading-relaxed text-paper/85">“{QUOTES[q].text}”</p>
                <footer className="mt-2.5 font-mono text-[10.5px] text-paper/45">{QUOTES[q].by}</footer>
              </motion.blockquote>
            </AnimatePresence>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between font-mono text-[10.5px] text-paper/40">
          <span>2,300+ teams onboard</span>
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-lime opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-lime" />
            </span>
            41M leads last quarter
          </span>
        </div>
      </div>
    </aside>
  );
}

export default function AuthShell({
  title,
  meta,
  heading,
  sub,
  children,
  foot,
}: {
  title: string;
  meta: string;
  heading: ReactNode;
  sub: string;
  children: ReactNode;
  foot: ReactNode;
}) {
  usePageMeta(title, meta);
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink lg:h-screen lg:flex-row lg:overflow-hidden">
      <Panel />
      <main className="relative flex flex-1 flex-col px-5 py-5 sm:px-10 lg:h-full">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:hidden" aria-label="zybble home">
            <Logo />
          </Link>
          <span className="hidden lg:block" />
          <Link
            to="/"
            className="group inline-flex items-center gap-1.5 font-mono text-xs text-ink/50 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 lg:min-h-0 lg:py-4">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <h1 className="font-display text-[1.9rem] font-bold tracking-[-0.02em] sm:text-4xl">{heading}</h1>
            <p className="mt-2 text-sm text-ink/55 sm:text-[15px]">{sub}</p>
            <div className="mt-6">{children}</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-6"
          >
            {foot}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/* shared bits */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
        {label}
        {error && <span className="normal-case tracking-normal text-red-500">{error}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-ink/15 bg-white/70 px-4 py-3 text-[15px] text-ink placeholder:text-ink/35 outline-none transition-all focus:border-ink/50 focus:bg-white focus:ring-4 focus:ring-lime/40";


