"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Trash2,
  Tag,
  ListPlus,
  Download,
  Mail,
  Phone,
  Globe,
  Star,
  CheckSquare,
  Square,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Skeleton,
  Modal,
  Input,
  Select,
  EmailStatusBadge,
} from "@/components/app/primitives";
import { cn } from "@/lib/cn";
import type { LeadRow } from "@/types/database";

export interface LeadsTableProps {
  /** Pre-rendered first page from the server (no loading flash, good SEO). */
  initialLeads: LeadRow[];
  initialTotal: number | null;
  initialNextCursor: string | null;
  cities: string[];
  categories: string[];
  lists: { id: string; name: string }[];
  leadsRemaining: number;
}

interface QueryState {
  q: string;
  city: string;
  category: string;
  hasEmail: "" | "yes" | "no";
  hasPhone: "" | "yes" | "no";
  hasWebsite: "" | "yes" | "no";
  emailStatus: string;
  minRating: string;
  minScore: string;
  sort: "recent" | "name" | "rating" | "reviews" | "score" | "city";
  direction: "asc" | "desc";
}

const DEFAULT_QUERY: QueryState = {
  q: "",
  city: "",
  category: "",
  hasEmail: "",
  hasPhone: "",
  hasWebsite: "",
  emailStatus: "",
  minRating: "",
  minScore: "",
  sort: "recent",
  direction: "desc",
};

export default function LeadsTable({
  initialLeads,
  initialTotal,
  initialNextCursor,
  cities,
  categories,
  lists,
}: LeadsTableProps) {
  const router = useRouter();

  const [query, setQuery] = useState<QueryState>(DEFAULT_QUERY);
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [total, setTotal] = useState<number | null>(initialTotal);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [cursors, setCursors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [bulkOpen, setBulkOpen] = useState<"tag" | "list" | null>(null);
  const [tagValue, setTagValue] = useState("");
  const [targetList, setTargetList] = useState(lists[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const debouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback((q: QueryState, cursorValue?: string | null) => {
    const params = new URLSearchParams();
    if (q.q) params.set("q", q.q);
    if (q.city) params.set("city", q.city);
    if (q.category) params.set("category", q.category);
    if (q.hasEmail) params.set("hasEmail", q.hasEmail === "yes" ? "true" : "false");
    if (q.hasPhone) params.set("hasPhone", q.hasPhone === "yes" ? "true" : "false");
    if (q.hasWebsite) params.set("hasWebsite", q.hasWebsite === "yes" ? "true" : "false");
    if (q.emailStatus) params.set("emailStatus", q.emailStatus);
    if (q.minRating) params.set("minRating", q.minRating);
    if (q.minScore) params.set("minScore", q.minScore);
    params.set("sort", q.sort);
    params.set("direction", q.direction);
    if (cursorValue) params.set("cursor", cursorValue);
    params.set("limit", "50");
    return params;
  }, []);

  const load = useCallback(
    async (q: QueryState, cursorValue: string | null) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads?${buildParams(q, cursorValue).toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { leads: LeadRow[]; nextCursor: string | null; total: number | null };
        setLeads(body.leads);
        setCursor(body.nextCursor);
        setTotal(body.total);
      } finally {
        setLoading(false);
      }
    },
    [buildParams],
  );

  // Debounced server-side search (§37): the query runs in Postgres, not in JS.
  useEffect(() => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => {
      setCursors([]);
      void load(query, null);
    }, 300);
    return () => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current);
    };
  }, [query, load]);

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      leads.forEach((l) => next.delete(l.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      leads.forEach((l) => next.add(l.id));
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function bulkAction(action: string, extra: { tag?: string; listId?: string } = {}) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadIds: [...selected], action, ...extra }),
      });
      const body = (await res.json()) as { affected?: number; error?: { message: string } };
      if (!res.ok) {
        setToast(body.error?.message ?? "That action failed.");
        return;
      }
      setToast(`${body.affected ?? 0} lead(s) updated.`);
      setSelected(new Set());
      setBulkOpen(null);
      setTagValue("");
      await load(query, null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function nextPage() {
    if (!cursor) return;
    setCursors((prev) => [...prev, cursor]);
    void load(query, cursor);
  }

  function prevPage() {
    const prev = [...cursors];
    const target = prev.length > 1 ? prev[prev.length - 2] : null;
    setCursors(prev.slice(0, -1));
    void load(query, target);
  }

  const activeFilterCount = useMemo(
    () =>
      [
        query.city,
        query.category,
        query.hasEmail,
        query.hasPhone,
        query.hasWebsite,
        query.emailStatus,
        query.minRating,
        query.minScore,
      ].filter(Boolean).length,
    [query],
  );

  const exportParams = buildParams(query);

  return (
    <div>
      {/* ---------------- toolbar ---------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input
            value={query.q}
            onChange={(e) => setQuery({ ...query, q: e.target.value })}
            placeholder="Search business name, category, city…"
            className="w-full rounded-full border border-ink/15 bg-white/70 py-2.5 pl-11 pr-10 text-[15px] outline-none transition-all focus:border-ink/50 focus:bg-white focus:ring-4 focus:ring-lime/40"
          />
          {query.q && (
            <button
              onClick={() => setQuery({ ...query, q: "" })}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button variant="outline" size="md" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && <Badge tone="lime">{activeFilterCount}</Badge>}
        </Button>

        <Select
          value={query.sort}
          onChange={(e) => setQuery({ ...query, sort: e.target.value as QueryState["sort"] })}
          className="w-auto min-w-[150px] rounded-full py-2.5 text-sm"
        >
          <option value="recent">Newest</option>
          <option value="name">Name</option>
          <option value="rating">Rating</option>
          <option value="reviews">Reviews</option>
          <option value="score">Lead score</option>
          <option value="city">City</option>
        </Select>

        <Button
          variant="outline"
          size="md"
          onClick={() => setQuery({ ...query, direction: query.direction === "asc" ? "desc" : "asc" })}
          aria-label="Toggle sort direction"
        >
          {query.direction === "asc" ? "↑" : "↓"}
        </Button>

        <a
          href={`/api/exports/download?${exportParams.toString()}`}
          className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/35"
        >
          <Download className="h-4 w-4" />
          Export
        </a>
      </div>

      {/* ---------------- filters ---------------- */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <Card className="mb-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Select label="City" value={query.city} onChange={(e) => setQuery({ ...query, city: e.target.value })}>
                  <option value="">Any</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Category"
                  value={query.category}
                  onChange={(e) => setQuery({ ...query, category: e.target.value })}
                >
                  <option value="">Any</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Has email"
                  value={query.hasEmail}
                  onChange={(e) => setQuery({ ...query, hasEmail: e.target.value as QueryState["hasEmail"] })}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
                <Select
                  label="Has phone"
                  value={query.hasPhone}
                  onChange={(e) => setQuery({ ...query, hasPhone: e.target.value as QueryState["hasPhone"] })}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
                <Select
                  label="Has website"
                  value={query.hasWebsite}
                  onChange={(e) => setQuery({ ...query, hasWebsite: e.target.value as QueryState["hasWebsite"] })}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
                <Select
                  label="Email status"
                  value={query.emailStatus}
                  onChange={(e) => setQuery({ ...query, emailStatus: e.target.value })}
                >
                  <option value="">Any</option>
                  <option value="valid">Valid</option>
                  <option value="unknown">Unknown</option>
                  <option value="risky">Risky</option>
                  <option value="invalid">Invalid</option>
                </Select>
                <Input
                  label="Min rating"
                  type="number"
                  step="0.1"
                  min={0}
                  max={5}
                  value={query.minRating}
                  onChange={(e) => setQuery({ ...query, minRating: e.target.value })}
                  placeholder="any"
                />
                <Input
                  label="Min lead score"
                  type="number"
                  min={0}
                  max={100}
                  value={query.minScore}
                  onChange={(e) => setQuery({ ...query, minScore: e.target.value })}
                  placeholder="any"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setQuery(DEFAULT_QUERY)}>
                  <X className="h-3.5 w-3.5" />
                  Reset filters
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- bulk bar ---------------- */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/12 bg-ink px-4 py-3 text-paper"
          >
            <span className="font-mono text-xs">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setBulkOpen("tag")} disabled={busy}>
                <Tag className="h-3.5 w-3.5" />
                Tag
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkOpen("list")} disabled={busy}>
                <ListPlus className="h-3.5 w-3.5" />
                Add to list
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void bulkAction("mark_contacted")}
                disabled={busy}
              >
                Mark contacted
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm(`Delete ${selected.size} lead(s)? This can't be undone.`)) {
                    void bulkAction("delete");
                  }
                }}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-paper/70">
                Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- table ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
        <div className="flex items-center justify-between gap-3 border-b border-ink/8 px-4 py-3">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2.5 text-sm font-medium text-ink/70 hover:text-ink"
          >
            {allSelected ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
            Select page
          </button>
          <p className="font-mono text-[11px] text-ink/45">
            {total !== null ? `${total.toLocaleString()} lead${total === 1 ? "" : "s"} match` : "—"}
            {loading && " · loading"}
          </p>
        </div>

        {loading && leads.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No leads match"
            body="Try widening your filters, or run a new search to add more businesses."
            action={
              <Link
                href="/find-leads"
                className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-bold text-ink"
              >
                <Plus className="h-4 w-4" />
                Find leads
              </Link>
            }
          />
        ) : (
          <ul className={cn("divide-y divide-ink/8", loading && "opacity-60")}>
            {leads.map((lead) => (
              <li key={lead.id} className={cn("flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-ink/[0.02]", selected.has(lead.id) && "bg-lime/[0.07]")}>
                <button
                  onClick={() => toggleOne(lead.id)}
                  className="mt-1 shrink-0 text-ink/40 hover:text-ink"
                  aria-label={`Select ${lead.business_name}`}
                >
                  {selected.has(lead.id) ? (
                    <CheckSquare className="h-4.5 w-4.5" />
                  ) : (
                    <Square className="h-4.5 w-4.5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/leads/${lead.id}`} className="truncate font-semibold hover:underline">
                      {lead.business_name}
                    </Link>
                    {lead.is_dev_data && <Badge tone="amber">dev</Badge>}
                    {lead.contacted_at && <Badge tone="lime">contacted</Badge>}
                  </div>

                  <p className="mt-0.5 truncate font-mono text-[11px] text-ink/45">
                    {[lead.category, lead.city, lead.state].filter(Boolean).join(" · ") || "—"}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 font-mono text-[11px] text-ink/60">
                    {lead.primary_email ? (
                      <span className="flex items-center gap-1.5 text-forest">
                        <Mail className="h-3 w-3" />
                        <span className="max-w-[180px] truncate">{lead.primary_email}</span>
                        <EmailStatusBadge status={lead.email_status} />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink/30">
                        <Mail className="h-3 w-3" /> no email
                      </span>
                    )}
                    {lead.primary_phone ? (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {lead.primary_phone}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink/30">
                        <Phone className="h-3 w-3" /> no phone
                      </span>
                    )}
                    {lead.website && (
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3" />
                        site
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {lead.rating !== null && (
                    <p className="flex items-center justify-end gap-1 font-mono text-xs">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {lead.rating}
                      <span className="text-ink/35">({lead.review_count ?? 0})</span>
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink/35">
                    score {lead.lead_score}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* pagination */}
        <div className="flex items-center justify-between gap-3 border-t border-ink/8 px-4 py-3">
          <Button size="sm" variant="ghost" onClick={prevPage} disabled={cursors.length === 0 || loading}>
            Previous
          </Button>
          <span className="font-mono text-[11px] text-ink/45">Page {cursors.length + 1}</span>
          <Button size="sm" variant="ghost" onClick={nextPage} disabled={!cursor || loading}>
            Next
          </Button>
        </div>
      </div>

      {/* ---------------- modals ---------------- */}
      <Modal
        open={bulkOpen === "tag"}
        onClose={() => setBulkOpen(null)}
        title="Tag selected leads"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(null)}>
              Cancel
            </Button>
            <Button variant="lime" onClick={() => void bulkAction("tag", { tag: tagValue })} disabled={!tagValue || busy}>
              Apply tag
            </Button>
          </>
        }
      >
        <Input
          label="Tag"
          value={tagValue}
          onChange={(e) => setTagValue(e.target.value)}
          placeholder="e.g. q3-outbound"
          hint={`Applied to ${selected.size} lead(s).`}
        />
      </Modal>

      <Modal
        open={bulkOpen === "list"}
        onClose={() => setBulkOpen(null)}
        title="Add selected leads to a list"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="lime"
              onClick={() => void bulkAction("add_to_list", { listId: targetList })}
              disabled={!targetList || busy}
            >
              Add to list
            </Button>
          </>
        }
      >
        {lists.length === 0 ? (
          <p className="text-sm text-ink/60">
            You don&apos;t have any lists yet.{" "}
            <Link href="/lists" className="font-semibold underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <Select label="List" value={targetList} onChange={(e) => setTargetList(e.target.value)}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
      </Modal>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper shadow-[0_20px_50px_-12px_rgba(11,16,14,0.5)]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
