"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Plus, X, Info, AlertCircle } from "lucide-react";
import { Button, Input, Select, Toggle, Card, CardHeader, Badge } from "@/components/app/primitives";
import { cn } from "@/lib/cn";

export interface NewSearchFormProps {
  leadsRemaining: number;
  monthlyLeads: number;
  planName: string;
  devMode: boolean;
}

interface CreatedJob {
  id: string;
  requested_limit: number;
}

export default function NewSearchForm({ leadsRemaining, monthlyLeads, devMode }: NewSearchFormProps) {
  const router = useRouter();

  const [keywords, setKeywords] = useState<string[]>([""]);
  const [locations, setLocations] = useState<string[]>([""]);
  const [requestedLimit, setRequestedLimit] = useState(Math.min(100, Math.max(10, leadsRemaining)));
  const [radius, setRadius] = useState<number | "">("");
  const [language, setLanguage] = useState("en");
  const [minRating, setMinRating] = useState("");
  const [minReviews, setMinReviews] = useState("");
  const [requireWebsite, setRequireWebsite] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [businessStatus, setBusinessStatus] = useState("all");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedJob | null>(null);

  const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean);
  const cleanLocations = locations.map((l) => l.trim()).filter(Boolean);
  const valid = cleanKeywords.length > 0 && cleanLocations.length > 0 && requestedLimit > 0;

  function updateList(list: string[], setList: (next: string[]) => void, index: number, value: string) {
    const next = [...list];
    next[index] = value;
    setList(next);
  }

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    setCreated(null);

    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keywords: cleanKeywords,
          locations: cleanLocations,
          radius: radius === "" ? null : Number(radius),
          requestedLimit,
          language,
          minRating: minRating === "" ? null : Number(minRating),
          minReviewCount: minReviews === "" ? null : Number(minReviews),
          requireWebsite,
          requirePhone,
          requireEmail,
          businessStatus,
          extraOptions: {},
        }),
      });

      const body = (await res.json()) as {
        job?: CreatedJob;
        cappedTo?: number | null;
        error?: { message: string; details?: Record<string, string> };
      };

      if (!res.ok || !body.job) {
        setError(body.error?.message ?? "Could not start that search.");
        return;
      }

      if (body.cappedTo) {
        setNotice(
          `Requested volume was capped to ${body.cappedTo.toLocaleString()} leads — the remainder of your monthly allowance.`,
        );
      }

      setCreated(body.job);
      router.refresh();
      // Let the user see the confirmation before navigating to live progress.
      setTimeout(() => router.push(`/searches/${body.job!.id}`), 900);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const overQuota = requestedLimit > leadsRemaining;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* ---------------- form ---------------- */}
      <div className="space-y-5 lg:col-span-3">
        <Card>
          <CardHeader title="What are you looking for?" sub="Keyword + location is all we need to start." />

          <div className="space-y-5">
            <TokenList
              label="Keywords"
              hint='e.g. "roofing contractor", "dentist"'
              items={keywords}
              onChange={setKeywords}
              onUpdate={(i, v) => updateList(keywords, setKeywords, i, v)}
              placeholder="roofing contractor"
              max={20}
            />
            <TokenList
              label="Locations"
              hint='e.g. "Denver, CO", "Leeds, UK"'
              items={locations}
              onChange={setLocations}
              onUpdate={(i, v) => updateList(locations, setLocations, i, v)}
              placeholder="Denver, CO"
              max={20}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Lead volume"
                type="number"
                min={1}
                max={200000}
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(Math.max(1, Number(e.target.value) || 0))}
                hint={`${leadsRemaining.toLocaleString()} remaining of ${monthlyLeads.toLocaleString()}`}
                error={overQuota ? "above remaining quota" : undefined}
              />
              <Input
                label="Radius (metres)"
                type="number"
                min={100}
                max={100000}
                value={radius}
                onChange={(e) => setRadius(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="optional"
                hint="Applied to the search area"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Filters" sub="Applied by the worker — the scraper engine has no equivalent flags." />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Min rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              placeholder="any"
            />
            <Input
              label="Min reviews"
              type="number"
              min={0}
              value={minReviews}
              onChange={(e) => setMinReviews(e.target.value)}
              placeholder="any"
            />
            <Select label="Business status" value={businessStatus} onChange={(e) => setBusinessStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="open">Open only</option>
              <option value="closed">Closed only</option>
            </Select>
          </div>

          <div className="mt-5 space-y-4 border-t border-ink/8 pt-5">
            <Toggle
              checked={requireWebsite}
              onChange={setRequireWebsite}
              label="Must have a website"
              description="Drops results without a business website."
            />
            <Toggle
              checked={requirePhone}
              onChange={setRequirePhone}
              label="Must have a phone number"
              description="Drops results without any phone."
            />
            <Toggle
              checked={requireEmail}
              onChange={setRequireEmail}
              label="Must have an email"
              description="Only keeps leads where an address was found."
            />
          </div>

          <div className="mt-5 border-t border-ink/8 pt-5">
            <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="nl">Dutch</option>
            </Select>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="lime" size="lg" onClick={submit} disabled={!valid || submitting} loading={submitting}>
            <Crosshair className="h-4.5 w-4.5" />
            {submitting ? "Queueing…" : "Start search"}
          </Button>
          <p className="font-mono text-[11px] text-ink/45">
            {cleanKeywords.length} keyword{cleanKeywords.length === 1 ? "" : "s"} × {cleanLocations.length} location
            {cleanLocations.length === 1 ? "" : "s"}
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </motion.p>
          )}
          {notice && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </motion.p>
          )}
          {created && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-forest px-4 py-3 text-sm text-lime"
            >
              Queued. Opening live progress…
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------- summary ---------------- */}
      <div className="lg:col-span-2">
        <Card dark className="sticky top-24">
          <CardHeader title="Before you run" sub="How billing and coverage work" dark />

          <ul className="space-y-3.5 text-sm text-paper/70">
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
              You only pay for <strong className="text-paper">unique leads actually saved</strong>. Duplicate
              detections never consume quota.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
              Google Maps returns at most ~120 results per query. Larger volumes fan out across multiple queries
              automatically.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
              Emails found by the engine are recorded as <strong className="text-paper">unverified</strong> until a
              verification result exists.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
              One search runs at a time per workspace, so you can&apos;t exceed your allowance with parallel jobs.
            </li>
          </ul>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-paper/45">Estimated coverage</p>
            <p className="mt-1.5 font-display text-2xl font-bold text-lime">
              ~{Math.min(requestedLimit, leadsRemaining).toLocaleString()}
            </p>
            <p className="mt-1 font-mono text-[10.5px] text-paper/40">
              capped by remaining quota · actual unique results may be lower
            </p>
          </div>

          {devMode && (
            <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3.5">
              <Badge tone="amber">dev mode</Badge>
              <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
                The worker is running with <code className="font-mono">WORKER_DEV_MODE=true</code>. Jobs are fulfilled
                with clearly-labelled simulated data instead of real Google Maps scraping.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TokenList({
  label,
  hint,
  items,
  onChange,
  onUpdate,
  placeholder,
  max,
}: {
  label: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
  onUpdate: (index: number, value: string) => void;
  placeholder: string;
  max: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">{label}</span>
        <span className="font-mono text-[10px] text-ink/40">{hint}</span>
      </div>
      <div className="space-y-2">
        {items.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => onUpdate(index, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5 text-[15px] text-ink placeholder:text-ink/35 outline-none transition-all focus:border-ink/50 focus:bg-white focus:ring-4 focus:ring-lime/40"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink/15 text-ink/45 transition-colors hover:text-red-600"
                aria-label={`Remove ${label} ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className={cn(
            "mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3.5 py-1.5 font-mono text-[11px] text-ink/60 transition-colors hover:border-ink/35 hover:text-ink",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          add {label.toLowerCase().replace(/s$/, "")}
        </button>
      )}
    </div>
  );
}
