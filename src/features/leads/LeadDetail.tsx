"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Globe,
  MapPin,
  Phone,
  Mail,
  Star,
  Clock,
  Copy,
  ExternalLink,
  Trash2,
  Save,
  ListPlus,
  CheckCircle2,
  Info,
  FlaskConical,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Button,
  Input,
  Textarea,
  Badge,
  StatusBadge,
  EmailStatusBadge,
  Modal,
  Select,
} from "@/components/app/primitives";
import type { LeadRow, LeadEmailRow, LeadPhoneRow } from "@/types/database";
import { cn } from "@/lib/cn";

interface Props {
  lead: LeadRow;
  contacts: { emails: LeadEmailRow[]; phones: LeadPhoneRow[]; tags: string[] };
  lists: { id: string; name: string; color: string | null }[];
  allLists: { id: string; name: string }[];
}

export default function LeadDetail({ lead, contacts, lists, allLists }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(contacts.tags);
  const [newTag, setNewTag] = useState("");
  const [listModal, setListModal] = useState(false);
  const [targetList, setTargetList] = useState(allLists[0]?.id ?? "");

  const [form, setForm] = useState({
    businessName: lead.business_name,
    website: lead.website ?? "",
    phone: lead.primary_phone ?? "",
    email: lead.primary_email ?? "",
    address: lead.address ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    country: lead.country ?? "",
    postalCode: lead.postal_code ?? "",
    category: lead.category ?? "",
    notes: lead.notes ?? "",
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          website: form.website || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          country: form.country || null,
          postalCode: form.postalCode || null,
          category: form.category || null,
          notes: form.notes || null,
        }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Could not save those changes.");
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this lead? It will be removed from lists and exports.")) return;
    setDeleting(true);
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/leads");
      router.refresh();
    } else {
      setError("Could not delete that lead.");
      setDeleting(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Clipboard access was blocked by your browser.");
    }
  }

  async function addTag() {
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) return;
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadIds: [lead.id], action: "tag", tag }),
    });
    if (res.ok) {
      setTags([...tags, tag]);
      setNewTag("");
      router.refresh();
    }
  }

  async function removeTag(tag: string) {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadIds: [lead.id], action: "untag", tag }),
    });
    if (res.ok) {
      setTags(tags.filter((t) => t !== tag));
      router.refresh();
    }
  }

  async function addToList() {
    if (!targetList) return;
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadIds: [lead.id], action: "add_to_list", listId: targetList }),
    });
    if (res.ok) {
      setListModal(false);
      router.refresh();
    }
  }

  async function markContacted() {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadIds: [lead.id], action: "mark_contacted" }),
    });
    router.refresh();
  }

  const hours = lead.opening_hours as Record<string, string> | null;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* ---------------- main ---------------- */}
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">{lead.business_name}</h1>
                {lead.is_dev_data && (
                  <Badge tone="amber">
                    <FlaskConical className="h-3 w-3" />
                    dev data
                  </Badge>
                )}
                {lead.contacted_at && <Badge tone="lime">contacted</Badge>}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink/50">
                {lead.category && <span>{lead.category}</span>}
                {lead.rating !== null && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {lead.rating}
                    <span className="text-ink/35">({lead.review_count ?? 0} reviews)</span>
                  </span>
                )}
                {lead.business_status && <StatusBadge status={lead.business_status.replace(/_/g, " ")} />}
              </p>
            </div>
            <div className="flex gap-2">
              {!editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={remove} loading={deleting}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="lime" onClick={save} loading={saving}>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>

          {saved && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm text-lime"
            >
              <CheckCircle2 className="h-4 w-4" />
              Saved.
            </motion.p>
          )}
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {editing ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Input
                label="Business name"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
              <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              <Input
                label="Postal code"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Anything useful about this lead…"
                />
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Field icon={Globe} label="Website">
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 truncate text-sm font-medium text-ink hover:underline"
                  >
                    {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-ink/40">Not found</span>
                )}
              </Field>

              <Field icon={MapPin} label="Address">
                <p className="text-sm text-ink/75">
                  {[lead.address, lead.city, lead.state, lead.postal_code, lead.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
                {lead.maps_url && (
                  <a
                    href={lead.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink"
                  >
                    Open in Google Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Field>

              <Field icon={Phone} label="Phone numbers">
                {contacts.phones.length === 0 ? (
                  <span className="text-sm text-ink/40">None found</span>
                ) : (
                  <ul className="space-y-1.5">
                    {contacts.phones.map((phone) => (
                      <li key={phone.id} className="flex items-center gap-2">
                        <a href={`tel:${phone.e164}`} className="font-mono text-sm hover:underline">
                          {phone.raw}
                        </a>
                        <button
                          onClick={() => void copy(phone.e164, `phone-${phone.id}`)}
                          className="text-ink/35 hover:text-ink"
                          aria-label="Copy phone"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {copied === `phone-${phone.id}` && (
                          <span className="font-mono text-[10px] text-lime-2">copied</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Field>

              <Field icon={Mail} label="Emails">
                {contacts.emails.length === 0 ? (
                  <span className="text-sm text-ink/40">None found</span>
                ) : (
                  <ul className="space-y-2">
                    {contacts.emails.map((email) => (
                      <li key={email.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm">{email.email}</span>
                        <EmailStatusBadge status={email.status} />
                        <button
                          onClick={() => void copy(email.email, `email-${email.id}`)}
                          className="text-ink/35 hover:text-ink"
                          aria-label="Copy email"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {copied === `email-${email.id}` && (
                          <span className="font-mono text-[10px] text-lime-2">copied</span>
                        )}
                        {email.reason && (
                          <span className="w-full text-[11px] text-ink/45">{email.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
            </div>
          )}

          {hours && Object.keys(hours).length > 0 && (
            <div className="mt-6 border-t border-ink/8 pt-5">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/45">
                <Clock className="h-3 w-3" />
                Opening hours
              </p>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(hours).map(([day, value]) => (
                  <div key={day} className="flex justify-between gap-3">
                    <dt className="capitalize text-ink/55">{day}</dt>
                    <dd className="text-ink/80">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {lead.description && (
            <p className="mt-5 border-t border-ink/8 pt-5 text-sm leading-relaxed text-ink/65">{lead.description}</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Notes" sub="Only visible to your workspace." />
          {editing ? (
            <p className="text-sm text-ink/45">Notes are edited above.</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/70">
              {lead.notes || "No notes yet."}
            </p>
          )}
        </Card>
      </div>

      {/* ---------------- sidebar ---------------- */}
      <div className="space-y-5">
        <Card>
          <CardHeader title="Actions" />
          <div className="space-y-2">
            <Button variant="outline" size="md" className="w-full" onClick={markContacted}>
              <CheckCircle2 className="h-4 w-4" />
              {lead.contacted_at ? "Update contacted date" : "Mark contacted"}
            </Button>
            <Button variant="outline" size="md" className="w-full" onClick={() => setListModal(true)}>
              <ListPlus className="h-4 w-4" />
              Add to list
            </Button>
            <a
              href={`/api/exports/download?scope=selected&leadIds=${lead.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/35"
            >
              Export as CSV
            </a>
          </div>
        </Card>

        <Card>
          <CardHeader title="Lists" />
          {lists.length === 0 ? (
            <p className="text-sm text-ink/50">Not in any list yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {lists.map((list) => (
                <li key={list.id}>
                  <Link
                    href={`/lists/${list.id}`}
                    className="flex items-center justify-between rounded-xl border border-ink/8 px-3.5 py-2 text-sm transition-colors hover:border-ink/20"
                  >
                    {list.name}
                    <ExternalLink className="h-3 w-3 text-ink/35" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Tags" />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tags.length === 0 ? (
              <p className="text-sm text-ink/50">No tags.</p>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => void removeTag(tag)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-ink/[0.04] px-3 py-1 font-mono text-[11px] text-ink/70 hover:border-red-200 hover:text-red-600"
                >
                  {tag}
                  <span className="text-ink/30 group-hover:text-red-400">×</span>
                </button>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addTag();
              }}
              placeholder="add a tag"
              className="w-full rounded-xl border border-ink/15 bg-white/70 px-3.5 py-2 text-sm outline-none focus:border-ink/50 focus:ring-4 focus:ring-lime/40"
            />
            <Button size="sm" variant="lime" onClick={() => void addTag()} disabled={!newTag.trim()}>
              Add
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Source"
            sub="Where this record came from"
          />
          <dl className="space-y-2 text-sm">
            <MetaRow label="Source" value={lead.source} />
            <MetaRow label="Source id" value={lead.source_id ?? "—"} mono />
            <MetaRow label="Times seen" value={String(lead.times_seen)} />
            <MetaRow label="Lead score" value={String(lead.lead_score)} />
            <MetaRow label="Coordinates" value={lead.latitude !== null && lead.longitude !== null ? `${lead.latitude.toFixed(5)}, ${lead.longitude.toFixed(5)}` : "—"} mono />
            {lead.plus_code && <MetaRow label="Plus code" value={lead.plus_code} mono />}
            {lead.price_range && <MetaRow label="Price range" value={lead.price_range} />}
            <MetaRow label="Added" value={new Date(lead.created_at).toLocaleString("en-US")} />
          </dl>

          {lead.search_id && (
            <Link
              href={`/searches/${lead.search_id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink/60 hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" />
              View originating search
            </Link>
          )}
        </Card>
      </div>

      <Modal
        open={listModal}
        onClose={() => setListModal(false)}
        title="Add to list"
        footer={
          <>
            <Button variant="ghost" onClick={() => setListModal(false)}>
              Cancel
            </Button>
            <Button variant="lime" onClick={() => void addToList()} disabled={!targetList}>
              Add
            </Button>
          </>
        }
      >
        {allLists.length === 0 ? (
          <p className="text-sm text-ink/60">
            No lists yet.{" "}
            <Link href="/lists" className="font-semibold underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <Select label="List" value={targetList} onChange={(e) => setTargetList(e.target.value)}>
            {allLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
      </Modal>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Globe;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/45">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      {children}
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink/50">{label}</dt>
      <dd className={cn("truncate text-right text-ink/80", mono && "font-mono text-[11px]")}>{value}</dd>
    </div>
  );
}
