"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Toggle } from "@/components/app/primitives";
import { Save } from "lucide-react";

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default function ProfileForm({
  email,
  fullName,
  company,
  timezone,
  productEmailOptIn,
  marketingOptIn,
  dataRetentionDays,
}: {
  email: string;
  fullName: string | null;
  company: string | null;
  timezone: string;
  productEmailOptIn: boolean;
  marketingOptIn: boolean;
  dataRetentionDays: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: fullName ?? "",
    company: company ?? "",
    timezone,
    productEmailOptIn,
    marketingOptIn,
    dataRetentionDays,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not save your profile.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <Input
          label="Email"
          value={email}
          disabled
          hint="Your sign-in email can't be changed here — contact support to transfer an account."
        />
        <Input
          label="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          maxLength={120}
        />
        <Input
          label="Company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          maxLength={160}
        />
        <Select
          label="Timezone"
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
        <Input
          label="Keep lead data for (days)"
          type="number"
          min={30}
          max={3650}
          value={form.dataRetentionDays}
          onChange={(e) =>
            setForm({ ...form, dataRetentionDays: Math.min(3650, Math.max(30, Number(e.target.value) || 30)) })
          }
          hint="Scraped leads older than this are purged by the nightly job."
        />

        <div className="space-y-3 border-t border-ink/8 pt-4">
          <Toggle
            label="Product emails"
            description="Feature announcements and tips. Never marketing for third parties."
            checked={form.productEmailOptIn}
            onChange={(v) => setForm({ ...form, productEmailOptIn: v })}
          />
          <Toggle
            label="Marketing emails"
            description="Occasional playbooks and offers from zybble."
            checked={form.marketingOptIn}
            onChange={(v) => setForm({ ...form, marketingOptIn: v })}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="lime" disabled={pending}>
            <Save className="h-3.5 w-3.5" />
            {pending ? "Saving…" : "Save changes"}
          </Button>
          {saved && !pending && <span className="font-mono text-[11px] text-ink/45">Saved</span>}
        </div>
      </form>
    </Card>
  );
}
