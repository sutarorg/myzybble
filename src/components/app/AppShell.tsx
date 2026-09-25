"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Crosshair,
  Users,
  ListChecks,
  History,
  Megaphone,
  Workflow,
  Mailbox,
  Sparkles,
  CreditCard,
  Settings,
  Menu,
  X,
  Bell,
  ChevronDown,
  LogOut,
  FlaskConical,
} from "lucide-react";
import { LogoMark } from "@/components/marketing/ui";
import { cn } from "@/lib/cn";
import { EASE, Badge } from "@/components/app/primitives";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Find leads", href: "/find-leads", icon: Crosshair },
  { label: "AI assistant", href: "/ai", icon: Sparkles },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Lists", href: "/lists", icon: ListChecks },
  { label: "Searches", href: "/searches", icon: History },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Automations", href: "/automations", icon: Workflow },
  { label: "Mailboxes", href: "/mailboxes", icon: Mailbox },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

export interface ShellUser {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface ShellWorkspace {
  id: string;
  name: string;
  role: string;
}

export interface ShellEntitlements {
  planName: string;
  leadsUsed: number;
  monthlyLeads: number;
  leadsRemaining: number;
}

export default function AppShell({
  user,
  workspace,
  entitlements,
  devMode = false,
  children,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  entitlements: ShellEntitlements | null;
  devMode?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials =
    (user.fullName ?? user.email ?? "?")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "Z";

  const usagePct =
    entitlements && entitlements.monthlyLeads > 0
      ? Math.min(100, Math.round((entitlements.leadsUsed / entitlements.monthlyLeads) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ---------------- sidebar ---------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-white/10 bg-ink text-paper transition-transform duration-300",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="group inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-[0.7rem] bg-gradient-to-br from-lime to-lime-2 text-ink">
              <LogoMark className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">zybble</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9rem] font-medium transition-colors",
                  active ? "bg-lime text-ink" : "text-paper/65 hover:bg-white/[0.06] hover:text-paper",
                )}
              >
                <item.icon className={cn("h-4.5 w-4.5", active ? "text-ink" : "text-paper/50 group-hover:text-lime")} />
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-xl bg-lime"
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* usage meter */}
        {entitlements && (
          <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/45">
                {entitlements.planName}
              </span>
              <Link href="/billing" className="font-mono text-[10px] text-lime hover:underline">
                upgrade
              </Link>
            </div>
            <p className="mt-2 font-display text-xl font-bold text-paper">
              {entitlements.leadsRemaining.toLocaleString()}
              <span className="ml-1 font-mono text-[11px] font-medium text-paper/45">left</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn("h-full rounded-full transition-all", usagePct >= 90 ? "bg-red-400" : "bg-lime")}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] text-paper/40">
              {entitlements.leadsUsed.toLocaleString()} / {entitlements.monthlyLeads.toLocaleString()} this month
            </p>
          </div>
        )}

        {devMode && (
          <div className="mx-3 mb-3 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="font-mono text-[10px] leading-relaxed text-amber-200/90">
              Development mode. Simulated job data is clearly labelled in the UI.
            </p>
          </div>
        )}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ---------------- main ---------------- */}
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-ink/8 bg-paper/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setMobileOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-full border border-ink/15 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">Workspace</p>
                <p className="truncate text-sm font-semibold">{workspace.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/find-leads"
                className="hidden rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper transition-colors hover:bg-ink-3 sm:inline-flex"
              >
                New search
              </Link>

              <NotificationBell />

              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-ink/12 bg-white/70 py-1 pl-1 pr-2.5 transition-colors hover:border-ink/25"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[11px] font-bold text-lime">
                    {initials}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-ink/50 transition-transform", menuOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-[0_24px_60px_-16px_rgba(11,16,14,0.35)]"
                        role="menu"
                      >
                        <div className="border-b border-ink/8 px-4 py-3">
                          <p className="truncate text-sm font-semibold">{user.fullName ?? "Account"}</p>
                          <p className="truncate font-mono text-[11px] text-ink/50">{user.email}</p>
                          <div className="mt-2">
                            <Badge tone="neutral">{workspace.role}</Badge>
                          </div>
                        </div>
                        <div className="p-1.5">
                          {[
                            { label: "Profile", href: "/settings/profile" },
                            { label: "Workspace", href: "/settings/workspace" },
                            { label: "Billing", href: "/billing" },
                          ].map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="block rounded-xl px-3 py-2 text-sm text-ink/70 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                            >
                              {item.label}
                            </Link>
                          ))}
                          <button
                            onClick={signOut}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink/70 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    async function load() {
      const res = await fetch("/api/notifications?unread=1", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { unread?: number };
      setUnread(body.unread ?? 0);
    }

    async function subscribe() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      channel = supabase
        .channel("notifications-count")
        .on("broadcast", { event: "notification" }, () => {
          setUnread((n) => n + 1);
        })
        .subscribe();
    }

    void load();
    void subscribe();

    return () => {
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <Link
      href="/settings/notifications"
      onClick={() => router.prefetch("/settings/notifications")}
      className="relative grid h-9 w-9 place-items-center rounded-full border border-ink/12 bg-white/70 transition-colors hover:border-ink/25"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
    >
      <Bell className="h-4.5 w-4.5 text-ink/60" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 font-mono text-[9px] font-bold text-ink">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
