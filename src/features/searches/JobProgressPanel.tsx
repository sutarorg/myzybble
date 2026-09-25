"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Pause,
  Play,
  XCircle,
  RotateCcw,
  Radio,
  Globe,
  Phone,
  Mail,
  Copy,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { Button, Card, CardHeader, StatusBadge, ProgressBar, Badge } from "@/components/app/primitives";
import { createClient } from "@/lib/supabase/client";
import type { ScrapeJobRow, ScrapeJobStatus } from "@/types/database";
import { cn } from "@/lib/cn";

const TERMINAL: ScrapeJobStatus[] = ["completed", "failed", "cancelled"];

export default function JobProgressPanel({
  initialJob,
  searchId,
}: {
  initialJob: ScrapeJobRow;
  searchId?: string | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [realtimeState, setRealtimeState] = useState<"connecting" | "live" | "polling">("connecting");
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const isTerminal = TERMINAL.includes(job.status);

  // Elapsed-time clock for the duration row. Render stays pure: `nowMs` is
  // state, ticked once a second only while the job is still running.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (job.completed_at || !job.started_at) return;
    const tick = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, [job.completed_at, job.started_at]);
  const elapsedSeconds = job.started_at
    ? Math.max(
        0,
        Math.round(
          ((job.completed_at ? Date.parse(job.completed_at) : (nowMs ?? Date.parse(job.started_at))) -
            Date.parse(job.started_at)) /
            1000,
        ),
      )
    : null;

  /** Always re-read authoritative state from Postgres (§15). */
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { job: ScrapeJobRow };
    if (body.job) setJob(body.job);
  }, [job.id]);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function connect() {
      const supabase = createClient();

      // Broadast channel per job. Authorization is enforced by an RLS policy on
      // realtime.messages, so a user can only join their own workspace's jobs.
      const channel = supabase.channel(`job:${job.id}`, { config: { private: true } });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "UPDATE" }, (payload) => {
          const record = (payload as { payload?: { record?: ScrapeJobRow } }).payload?.record;
          if (record?.id === job.id && !cancelled) setJob(record);
        })
        .subscribe(async (status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setRealtimeState("live");
            // Reconcile immediately: an event may have been missed while connecting.
            await refresh();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setRealtimeState("polling");
          }
        });

      // Polling is the safety net, not the primary mechanism.
      poll = setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, isTerminal ? 15_000 : 5_000);
    }

    void connect();
    // Confirm current state on mount regardless of realtime. Deferred to a
    // timeout: the effect body itself performs no synchronous state updates.
    const initialRefresh = setTimeout(() => void refresh(), 0);

    return () => {
      cancelled = true;
      clearTimeout(initialRefresh);
      if (poll) clearInterval(poll);
      const channel = channelRef.current;
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, isTerminal]);

  // Refresh the server-rendered parts once the job finishes.
  useEffect(() => {
    if (isTerminal) router.refresh();
  }, [isTerminal, router]);

  async function control(action: "pause" | "resume" | "cancel" | "retry") {
    setActing(action);
    setError(null);
    try {
      const res = await fetch(`/api/searches/${job.id}/control`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json()) as { job?: ScrapeJobRow; error?: { message: string } };
      if (!res.ok || !body.job) {
        setError(body.error?.message ?? "Could not update that search.");
        return;
      }
      setJob(body.job);
      router.refresh();
    } finally {
      setActing(null);
    }
  }

  const pct = job.requested_limit > 0
    ? Math.min(100, Math.round((job.unique_results / job.requested_limit) * 100))
    : 0;

  const counters = [
    { label: "Discovered", value: job.actual_results, icon: Radio },
    { label: "Unique saved", value: job.unique_results, icon: Layers },
    { label: "Duplicates", value: job.duplicates, icon: Copy },
    { label: "Filtered", value: job.filtered, icon: AlertTriangle },
    { label: "Websites", value: job.websites_found, icon: Globe },
    { label: "Phones", value: job.phones_found, icon: Phone },
    { label: "Emails", value: job.emails_found, icon: Mail },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2.5">
              {job.keywords.join(", ") || "Search"}
              <StatusBadge status={job.status} />
            </span>
          }
          sub={
            realtimeState === "live"
              ? "Live — updating as the worker progresses"
              : realtimeState === "polling"
                ? "Live connection unavailable — refreshing automatically"
                : "Connecting…"
          }
          action={
            <div className="flex flex-wrap gap-2">
              {["queued", "starting", "running"].includes(job.status) && (
                <Button size="sm" variant="outline" onClick={() => control("pause")} loading={acting === "pause"}>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </Button>
              )}
              {job.status === "paused" && (
                <Button size="sm" variant="lime" onClick={() => control("resume")} loading={acting === "resume"}>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </Button>
              )}
              {!isTerminal && job.status !== "paused" && (
                <Button size="sm" variant="outline" onClick={() => control("cancel")} loading={acting === "cancel"}>
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
              {(job.status === "failed" || job.status === "cancelled") && (
                <Button size="sm" variant="lime" onClick={() => control("retry")} loading={acting === "retry"}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </div>
          }
        />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-4xl font-bold tracking-tight">
              {job.unique_results.toLocaleString()}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink/50">
              of {job.requested_limit.toLocaleString()} requested · {job.billable_leads.toLocaleString()} billable
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink/45">progress</p>
            <p className="font-display text-lg font-bold">{pct}%</p>
          </div>
        </div>

        <ProgressBar className="mt-4" value={job.unique_results} max={job.requested_limit} />

        {job.status === "running" && (
          <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-ink/50">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
            </span>
            Worker {job.worker_id ?? "—"} is scraping Google Maps…
          </p>
        )}

        {job.error_message && (
          <p
            className={cn(
              "mt-4 rounded-xl px-4 py-3 text-sm",
              job.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800",
            )}
          >
            {job.error_message}
          </p>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </Card>

      <Card>
        <CardHeader title="Live counters" sub="Every number below is read from the database." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counters.map((counter) => (
            <motion.div
              key={counter.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-ink/8 bg-white/60 p-3.5"
            >
              <div className="flex items-center gap-2">
                <counter.icon className="h-3.5 w-3.5 text-ink/40" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink/45">{counter.label}</span>
              </div>
              <p className="mt-1.5 font-display text-xl font-bold tabular-nums">
                {counter.value.toLocaleString()}
              </p>
            </motion.div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Search parameters" />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Keywords" value={job.keywords.join(", ")} />
          <Row label="Locations" value={job.locations.join(", ")} />
          <Row label="Radius" value={job.radius ? `${job.radius.toLocaleString()} m` : "default"} />
          <Row label="Language" value={job.language ?? "en"} />
          <Row label="Min rating" value={job.min_rating !== null ? String(job.min_rating) : "any"} />
          <Row label="Min reviews" value={job.min_review_count !== null ? String(job.min_review_count) : "any"} />
          <Row
            label="Requirements"
            value={
              [job.require_website && "website", job.require_phone && "phone", job.require_email && "email"]
                .filter(Boolean)
                .join(", ") || "none"
            }
          />
          <Row label="Business status" value={job.business_status ?? "all"} />
          <Row label="Engine" value={`${job.engine}${job.engine_version ? ` @ ${job.engine_version}` : ""}`} />
          <Row label="Duration" value={elapsedSeconds !== null ? `${elapsedSeconds}s` : "—"} />
          <Row label="Attempts" value={`${job.attempts} / ${job.max_attempts}`} />
          <Row label="Errors" value={String(job.errors)} />
        </dl>

        {searchId && (
          <div className="mt-5 border-t border-ink/8 pt-5">
            <a
              href={`/api/leads?searchId=${searchId}&format=csv`}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink-3"
            >
              Export these results (CSV)
            </a>
          </div>
        )}
      </Card>

      {job.engine_version?.includes("dev") && (
        <p className="flex items-center gap-2 text-xs text-amber-700">
          <Badge tone="amber">dev data</Badge>
          This job was fulfilled with simulated data.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink/45">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink/80">{value || "—"}</dd>
    </div>
  );
}
