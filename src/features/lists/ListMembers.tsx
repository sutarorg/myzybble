"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Trash2, Download, Mail, Phone, Star, CheckSquare, Square } from "lucide-react";
import { Button, Badge, EmptyState, EmailStatusBadge } from "@/components/app/primitives";
import type { LeadRow } from "@/types/database";
import { cn } from "@/lib/cn";

/**
 * List membership view.
 *
 * Search is debounced and evaluated in Postgres via /api/leads (scoped by
 * listId), so it stays fast even for lists with tens of thousands of members
 * (§37).
 */
export default function ListMembers({ listId, leads }: { listId: string; leads: LeadRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LeadRow[]>(leads);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ listId, limit: "100" });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { leads: LeadRow[] };
          setRows(body.leads);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, listId]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    setSelected(next);
  }

  async function removeSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} lead(s) from this list?`)) return;
    const res = await fetch(`/api/lists/${listId}/members`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadIds: [...selected] }),
    });
    if (res.ok) {
      setSelected(new Set());
      setRows(rows.filter((r) => !selected.has(r.id)));
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search within this list…"
            className="w-full rounded-full border border-ink/15 bg-white/70 py-2.5 pl-11 pr-4 text-[15px] outline-none transition-all focus:border-ink/50 focus:bg-white focus:ring-4 focus:ring-lime/40"
          />
        </div>
        <a
          href={`/api/exports/download?scope=list&listId=${listId}`}
          className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/35"
        >
          <Download className="h-4 w-4" />
          Export list
        </a>
        {selected.size > 0 && (
          <Button variant="danger" size="md" onClick={removeSelected}>
            <Trash2 className="h-4 w-4" />
            Remove {selected.size}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
        <div className="flex items-center justify-between gap-3 border-b border-ink/8 px-4 py-3">
          <button onClick={toggleAll} className="flex items-center gap-2.5 text-sm font-medium text-ink/70 hover:text-ink">
            {allSelected ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
            Select all
          </button>
          <p className="font-mono text-[11px] text-ink/45">
            {rows.length.toLocaleString()} shown{loading && " · loading"}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title={query ? "No matches in this list" : "This list is empty"}
            body={
              query
                ? "Try a different search term."
                : "Add leads from the Leads page, or run a search and add the results."
            }
            action={
              <Link
                href="/leads"
                className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-bold text-ink"
              >
                Browse leads
              </Link>
            }
          />
        ) : (
          <ul className={cn("divide-y divide-ink/8", loading && "opacity-60")}>
            {rows.map((lead) => (
              <li
                key={lead.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-ink/[0.02]",
                  selected.has(lead.id) && "bg-lime/[0.07]",
                )}
              >
                <button
                  onClick={() => {
                    const next = new Set(selected);
                    if (next.has(lead.id)) next.delete(lead.id);
                    else next.add(lead.id);
                    setSelected(next);
                  }}
                  className="mt-1 shrink-0 text-ink/40 hover:text-ink"
                  aria-label={`Select ${lead.business_name}`}
                >
                  {selected.has(lead.id) ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/leads/${lead.id}`} className="truncate font-semibold hover:underline">
                      {lead.business_name}
                    </Link>
                    {lead.is_dev_data && <Badge tone="amber">dev</Badge>}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-ink/45">
                    {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[11px]">
                    {lead.primary_email ? (
                      <span className="flex items-center gap-1.5 text-forest">
                        <Mail className="h-3 w-3" />
                        {lead.primary_email}
                        <EmailStatusBadge status={lead.email_status} />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink/30">
                        <Mail className="h-3 w-3" /> no email
                      </span>
                    )}
                    {lead.primary_phone && (
                      <span className="flex items-center gap-1.5 text-ink/60">
                        <Phone className="h-3 w-3" />
                        {lead.primary_phone}
                      </span>
                    )}
                  </div>
                </div>

                {lead.rating !== null && (
                  <p className="flex shrink-0 items-center gap-1 font-mono text-xs">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {lead.rating}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
