"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/app/primitives";
import { Save } from "lucide-react";

export default function WorkspaceForm({
  name,
  billingEmail,
  canEdit,
}: {
  name: string;
  billingEmail: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name, billingEmail: billingEmail ?? "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          billingEmail: form.billingEmail.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not save those settings.");
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
          label="Workspace name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          disabled={!canEdit}
          required
          maxLength={120}
        />
        <Input
          label="Billing email"
          type="email"
          value={form.billingEmail}
          onChange={(e) => setForm({ ...form, billingEmail: e.target.value })}
          disabled={!canEdit}
          placeholder="billing@yourcompany.com"
          hint="Receipts and payment failures go here."
        />

        {!canEdit && (
          <p className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-sm text-ink/60">
            Only an owner or admin can change workspace settings.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="lime" disabled={pending || !canEdit}>
            <Save className="h-3.5 w-3.5" />
            {pending ? "Saving…" : "Save changes"}
          </Button>
          {saved && !pending && <span className="font-mono text-[11px] text-ink/45">Saved</span>}
        </div>
      </form>
    </Card>
  );
}
