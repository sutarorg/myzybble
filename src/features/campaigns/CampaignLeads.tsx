"use client";

/**
 * Adds leads to a campaign and shows the live recipient list.
 *
 * Leads are selected by id from the server-rendered table below; the client
 * never decides who is eligible — `addLeadsToCampaign` re-checks workspace
 * ownership, suppression status and email presence before inserting.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, EmptyState, StatusBadge } from "@/components/app/primitives";
import { Users, UserPlus, Search, Trash2 } from "lucide-react";

export interface PickableLead {
  id: string;
  businessName: string;
  email: string | null;
  city: string | null;
  emailStatus: string | null;
}

export interface CampaignRecipient {
  id: string;
  email: string;
  status: string;
  currentStep: number;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  bouncedAt: string | null;
  failedAt: string | null;
  leadId: string;
  businessName: string | null;
}

export default function CampaignLeads({
  campaignId,
  available,
  recipients,
  readOnly,
}: {
  campaignId: string;
  available: PickableLead[];
  recipients: CampaignRecipient[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const enrolled = new Set(recipients.map((r) => r.leadId));
  const q = query.trim().toLowerCase();

  const matches = available.filter((lead) => {
    if (enrolled.has(lead.id)) return false;
    if (!q) return true;
    return (
      lead.businessName.toLowerCase().includes(q) ||
      (lead.email ?? "").toLowerCase().includes(q) ||
      (lead.city ?? "").toLowerCase().includes(q)
    );
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    setError(null);
    setResult(null);
    start(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadIds: [...selected] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not add those leads.");
        return;
      }
      setResult(
        `${body.added} added${body.skipped ? `, ${body.skipped} skipped (no email, already enrolled or suppressed)` : ""}`,
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  function remove(leadId: string) {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Recipients</h2>
            <p className="mt-0.5 text-sm text-ink/50">
              {recipients.length.toLocaleString()} enrolled
            </p>
          </div>
        </div>

        {recipients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No recipients yet"
            body="Pick leads from your workspace to enrol them in this sequence."
          />
        ) : (
          <ul className="mt-4 divide-y divide-ink/8">
            {recipients.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.businessName ?? r.email}
                  </p>
                  <p className="truncate font-mono text-[11px] text-ink/45">{r.email}</p>
                  {r.lastError && (
                    <p className="mt-0.5 truncate text-[11px] text-red-600">{r.lastError}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="font-mono text-[10.5px] text-ink/40">step {r.currentStep}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => remove(r.leadId)}
                      aria-label={`Remove ${r.email}`}
                      className="grid h-7 w-7 place-items-center rounded-lg text-ink/35 hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Add leads</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or city"
            className="pl-10"
          />
        </div>

        {!readOnly && selected.size > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Button variant="lime" onClick={add} disabled={busy}>
              <UserPlus className="h-3.5 w-3.5" />
              {busy ? "Adding…" : `Add ${selected.size} lead${selected.size === 1 ? "" : "s"}`}
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {result && (
          <p className="mt-3 rounded-xl bg-lime/20 px-3 py-2 text-xs text-ink">{result}</p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-500/8 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <ul className="mt-3 max-h-[26rem] divide-y divide-ink/8 overflow-y-auto">
          {matches.slice(0, 200).map((lead) => (
            <li key={lead.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(lead.id)}
                  onChange={() => toggle(lead.id)}
                  disabled={!lead.email}
                  className="h-4 w-4 rounded border-ink/25 accent-ink disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{lead.businessName}</p>
                  <p className="truncate font-mono text-[11px] text-ink/45">
                    {lead.email ?? "no email"}
                    {lead.city ? ` · ${lead.city}` : ""}
                  </p>
                </div>
                {lead.emailStatus && <Badge tone="neutral">{lead.emailStatus}</Badge>}
              </label>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="py-6 text-center text-sm text-ink/45">
              {available.length === 0
                ? "No leads yet — run a search first."
                : "No leads match that filter."}
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
