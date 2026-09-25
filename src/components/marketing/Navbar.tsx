"use client";

import { useEffect, useState } from "react";
import Link from "@/components/marketing/LinkCompat";
import { NavLink } from "./router-compat";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Logo, EASE } from "./ui";
import { cn } from "@/lib/cn";

const LINKS = [
  { label: "Features", to: "/features" },
  { label: "How it works", to: "/how-it-works" },
  { label: "Use cases", to: "/use-cases" },
  { label: "Pricing", to: "/pricing" },
  { label: "Blog", to: "/blog" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        <div
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between px-4 py-3 transition-all duration-500 sm:px-5",
            scrolled || open
              ? "mx-3 mt-3 rounded-2xl border border-ink/10 bg-paper/85 shadow-[0_12px_44px_rgba(11,16,14,0.10)] backdrop-blur-xl sm:mx-auto"
              : "mt-0 border border-transparent bg-transparent",
          )}
        >
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-4 py-2 text-[0.92rem] font-medium transition-colors",
                    isActive ? "bg-ink text-paper" : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/signin"
              className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:text-ink sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="group hidden items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-all hover:bg-ink-3 sm:inline-flex"
            >
              Start free
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <button
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* mobile overlay menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[90] flex flex-col bg-ink text-paper"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/20"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col justify-center gap-1 px-6">
              {LINKS.map((l, i) => (
                <motion.div
                  key={l.to}
                  initial={{ opacity: 0, x: -28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ delay: 0.06 * i + 0.08, duration: 0.5, ease: EASE }}
                >
                  <NavLink
                    to={l.to}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center justify-between border-b border-white/10 py-4.5 font-display text-3xl font-bold tracking-tight",
                        isActive && "text-lime",
                      )
                    }
                  >
                    {l.label}
                    <ArrowUpRight className="h-6 w-6 text-lime opacity-0 transition-opacity group-hover:opacity-100" />
                  </NavLink>
                </motion.div>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: EASE }}
              className="space-y-3 p-6"
            >
              <Link
                to="/signup"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-4 font-semibold text-ink"
              >
                Start generating leads — free
                <ArrowUpRight className="h-5 w-5" />
              </Link>
              <Link
                to="/signin"
                className="flex w-full items-center justify-center rounded-full border border-white/20 py-4 font-semibold text-paper"
              >
                Sign in
              </Link>
              <p className="pt-1 text-center font-mono text-xs text-paper/50">
                100 free leads · No credit card required
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
