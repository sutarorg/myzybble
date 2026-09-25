import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Logo, Reveal } from "./ui";

const XIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden>
    <path d="M18.9 1.2h3.7l-8.1 9.3L24 22.8h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L0 1.2h7.7l5.3 7 5.9-7z" />
  </svg>
);
const LinkedInIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.5c0-1.3 0-3-1.9-3-1.9 0-2.2 1.4-2.2 2.9V21H9z" />
  </svg>
);
const YouTubeIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden>
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4L15.8 12z" />
  </svg>
);

const COLS: { h: string; links: { label: string; to: string }[] }[] = [
  {
    h: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "How it works", to: "/how-it-works" },
      { label: "Pricing", to: "/pricing" },
      { label: "Changelog", to: "/changelog" },
      { label: "Roadmap", to: "/roadmap" },
    ],
  },
  {
    h: "Use cases",
    links: [
      { label: "Agencies", to: "/agencies" },
      { label: "Sales teams", to: "/sales-teams" },
      { label: "Local services", to: "/local-services" },
      { label: "Recruiters", to: "/recruiters" },
      { label: "All use cases", to: "/use-cases" },
    ],
  },
  {
    h: "Company",
    links: [
      { label: "About", to: "/company" },
      { label: "Blog", to: "/blog" },
      { label: "Careers", to: "/careers" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    h: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "DPA", to: "/dpa" },
      { label: "Compliance", to: "/compliance" },
    ],
  },
];

export function CTA() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.2rem] bg-lime px-6 py-16 text-center text-ink sm:py-20 lg:py-24">
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(11,16,14,0.08), transparent 32%), radial-gradient(circle at 80% 70%, rgba(11,16,14,0.08), transparent 32%)",
            }}
            aria-hidden
          />
          <MapPin className="absolute -left-8 -top-8 h-44 w-44 -rotate-12 text-ink/[0.07]" strokeWidth={1} aria-hidden />
          <MapPin className="absolute -bottom-10 -right-6 h-52 w-52 rotate-12 text-ink/[0.07]" strokeWidth={1} aria-hidden />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/10" aria-hidden />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/10" aria-hidden />

          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/55">
              free plan · 100 leads · no card
            </p>
            <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.04] tracking-[-0.03em] sm:text-6xl">
              The map is full of customers. Go get them.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-ink/65">
              Your next 5,000 leads are already listed, rated, and waiting. Search them before your
              competitor does.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="group inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 font-semibold text-paper transition-all duration-300 hover:shadow-[0_18px_50px_rgba(11,16,14,0.35)]"
              >
                Start free — claim 100 leads
                <ArrowRight className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink/20 px-8 py-[0.9rem] font-semibold text-ink transition-colors hover:border-ink/50"
              >
                See the workflow
              </Link>
            </div>
            <p className="mt-7 font-mono text-xs text-ink/45">
              2,300+ teams generated 41M leads last quarter
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function Footer() {
  return (
    <footer className="bg-ink pb-10 pt-16 text-paper">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-5 max-w-xs leading-relaxed text-paper/50">
              The Google Maps lead engine. Find any business, verify its contacts, and start the
              conversation — all in one place.
            </p>
            <Link
              to="/signin"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-paper/80 transition-all hover:border-lime hover:text-lime"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-6 flex gap-2.5">
              {[
                { icon: XIcon, label: "X / Twitter" },
                { icon: LinkedInIcon, label: "LinkedIn" },
                { icon: YouTubeIcon, label: "YouTube" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-paper/60 transition-all hover:border-lime hover:text-lime"
                >
                  <s.icon className="h-4.5 w-4.5" />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-9 sm:grid-cols-4 lg:col-span-8">
            {COLS.map((col) => (
              <div key={col.h}>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/40">{col.h}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="text-sm text-paper/65 transition-colors hover:text-lime">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 sm:flex-row">
          <p className="font-mono text-xs text-paper/40">© 2026 zybble inc. All rights reserved.</p>
          <p className="font-mono text-xs text-paper/40">
            Built for growth teams, <span className="text-lime">everywhere on the map</span>.
          </p>
        </div>
      </div>
    </footer>
  );
}
