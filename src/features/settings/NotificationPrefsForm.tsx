"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Toggle } from "@/components/app/primitives";
import { Save } from "lucide-react";

const GROUPS = [
  {
    title: "Searches",
    items: [
      { key: "searchCompleted", label: "Search completed", description: "When a scrape finishes and new leads are saved." },
      { key: "searchFailed", label: "Search failed", description: "When a scrape can't finish, with the reason." },
    ],
  },
  {
    title: "Billing",
    items: [
      { key: "subscriptionChanged", label: "Subscription changed", description: "Plan upgrades, downgrades and renewals." },
      { key: "paymentFailed", label: "Payment failed", description: "When we can't collect a subscription payment." },
    ],
  },
  {
    title: "Outreach",
    items: [
      { key: "campaignCompleted", label: "Campaign completed", description: "When a campaign finishes sending." },
    ],
  },
  {
    title: "Account",
    items: [
      { key: "usageThreshold", label: "Usage threshold", description: "When you're close to your monthly lead limit." },
      { key: "securityAlerts", label: "Security alerts", description: "Password changes, new sign-ins and deletion requests." },
      { key: "productUpdates", label: "Product updates", description: "Occasional release notes and tips." },
    ],
  },
] as const;

type PrefKey =
  (typeof GROUPS)[number]["items"][number]["key"];

export default function NotificationPrefsForm({
  initial,
}: {
  initial: Record<PrefKey, boolean>;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    start(async () => {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {GROUPS.map((group) => (
        <Card key={group.title}>
          <h2 className="font-display text-lg font-bold tracking-tight">{group.title}</h2>
          <div className="mt-4 space-y-4">
            {group.items.map((item) => (
              <Toggle
                key={item.key}
                label={item.label}
                description={item.description}
                checked={prefs[item.key]}
                onChange={(v) => setPrefs({ ...prefs, [item.key]: v })}
              />
            ))}
          </div>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="lime" disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {saved && !pending && <span className="font-mono text-[11px] text-ink/45">Saved</span>}
      </div>

      <p className="text-xs text-ink/45">
        Security-critical messages (payment failures, account deletion) are always sent if you have
        a verified email, even if you turn the toggle off. Unsubscribing from a campaign only stops
        that campaign — it doesn&apos;t affect these account emails.
      </p>
    </form>
  );
}
