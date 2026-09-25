"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { User, Building2, Plug, Bell, CreditCard } from "lucide-react";

const ITEMS = [
  { label: "Profile", href: "/settings/profile", icon: User },
  { label: "Workspace", href: "/settings/workspace", icon: Building2 },
  { label: "Integrations", href: "/settings/integrations", icon: Plug },
  { label: "Notifications", href: "/settings/notifications", icon: Bell },
  { label: "Billing", href: "/billing", icon: CreditCard },
];

export default function SettingsNav({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <nav className="lg:sticky lg:top-6 lg:self-start">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-ink font-medium text-paper"
                    : "text-ink/60 hover:bg-ink/5 hover:text-ink",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 hidden font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/35 lg:block">
        your role: {role}
      </p>
    </nav>
  );
}
