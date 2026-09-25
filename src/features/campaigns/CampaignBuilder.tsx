"use client";

/**
 * Campaign sequence editor.
 *
 * Steps are persisted as an ordered list of `email | wait | condition` rows.
 * `{{variables}}` are rendered server-side at send time (§22) — the browser
 * never interpolates recipient data into a template that it then submits, so a
 * malicious lead field can't inject content.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Textarea, Select, Badge } from "@/components/app/primitives";
import { PERSONALIZATION_VARIABLES } from "@/lib/personalization";
import { Mail, Clock, GitBranch, Plus, Trash2, Save, GripVertical } from "lucide-react";

export interface CampaignStep {
  id?: string;
  kind: "email" | "wait" | "condition";
  subject: string;
  body: string;
  delayMinutes: number;
  conditions: Record<string, unknown>;
}

const KIND_ICON = { email: Mail, wait: Clock, condition: GitBranch } as const;

const DEFAULT_BODY = `Hi {{first_name}},

I came across {{business_name}} in {{city}} and wanted to reach out.

{{ai_opener}}

Would it be worth a 10-minute call this week?

— {{sender_name}}`;

export default function CampaignBuilder({
  campaignId,
  initialSteps,
  dailyLimit,
  stopOnReply,
  timezone,
}: {
  campaignId: string;
  initialSteps: CampaignStep[];
  dailyLimit: number;
  stopOnReply: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<CampaignStep[]>(
    initialSteps.length > 0 ? initialSteps : [blankEmailStep()],
  );
  const [limit, setLimit] = useState(dailyLimit);
  const [stop, setStop] = useState(stopOnReply);
  const [tz, setTz] = useState(timezone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function update(index: number, patch: Partial<CampaignStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  function add(kind: CampaignStep["kind"]) {
    setSteps((prev) => [
      ...prev,
      kind === "email"
        ? blankEmailStep()
        : kind === "wait"
          ? { kind: "wait", subject: "", body: "", delayMinutes: 1440, conditions: {} }
          : { kind: "condition", subject: "", body: "", delayMinutes: 0, conditions: { field: "has_email", operator: "eq", value: true } },
    ]);
    setSaved(false);
  }

  function remove(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function move(index: number, delta: number) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function insertVariable(index: number, token: string) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, body: `${s.body}{{${token}}}` } : s)),
    );
    setSaved(false);
  }

  async function save() {
    setError(null);
    start(async () => {
      const [stepsRes, campaignRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/steps`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            steps: steps.map((s) => ({
              kind: s.kind,
              subject: s.subject || null,
              body: s.body || null,
              delayMinutes: s.delayMinutes,
              conditions: s.conditions,
            })),
          }),
        }),
        fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dailyLimit: limit, stopOnReply: stop, timezone: tz }),
        }),
      ]);

      if (!stepsRes.ok || !campaignRes.ok) {
        const body = await (stepsRes.ok ? campaignRes : stepsRes).json().catch(() => ({}));
        setError(body?.error?.message ?? "Could not save those changes.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Sequence</h2>
            <p className="mt-0.5 text-sm text-ink/50">
              Steps run in order. A delay is measured from the previous step.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => add("email")}>
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            <Button variant="ghost" onClick={() => add("wait")}>
              <Clock className="h-3.5 w-3.5" /> Wait
            </Button>
            <Button variant="ghost" onClick={() => add("condition")}>
              <GitBranch className="h-3.5 w-3.5" /> Condition
            </Button>
          </div>
        </div>

        <ol className="mt-5 space-y-3">
          {steps.map((step, index) => {
            const Icon = KIND_ICON[step.kind];
            return (
              <li key={index} className="rounded-2xl border border-ink/10 bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink font-mono text-[11px] text-lime">
                      {index + 1}
                    </span>
                    <Icon className="h-4 w-4 text-ink/50" />
                    <Badge tone={step.kind === "email" ? "lime" : "neutral"}>{step.kind}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Move step up"
                      className="grid h-7 w-7 place-items-center rounded-lg text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === steps.length - 1}
                      aria-label="Move step down"
                      className="grid h-7 w-7 rotate-180 place-items-center rounded-lg text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label="Delete step"
                      className="grid h-7 w-7 place-items-center rounded-lg text-ink/40 hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <Input
                      label="Delay before this step"
                      type="number"
                      min={0}
                      value={step.delayMinutes}
                      onChange={(e) =>
                        update(index, { delayMinutes: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                    <div className="self-end pb-3 font-mono text-[11px] text-ink/45">
                      {describeDelay(step.delayMinutes)}
                    </div>
                  </div>

                  {step.kind === "email" && (
                    <>
                      <Input
                        label="Subject"
                        value={step.subject}
                        onChange={(e) => update(index, { subject: e.target.value })}
                        placeholder="Quick question about {{business_name}}"
                        maxLength={200}
                      />
                      <Textarea
                        label="Body"
                        value={step.body}
                        onChange={(e) => update(index, { body: e.target.value })}
                        rows={8}
                        maxLength={20_000}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/40">
                          Insert
                        </span>
                        {PERSONALIZATION_VARIABLES.filter((v) => v !== "unsubscribe_link")
                          .slice(0, 8)
                          .map((token) => (
                            <button
                              key={token}
                              type="button"
                              onClick={() => insertVariable(index, token)}
                              className="rounded-full border border-ink/12 bg-white px-2.5 py-1 font-mono text-[11px] text-ink/65 transition-colors hover:border-ink/30 hover:text-ink"
                            >
                              {`{{${token}}}`}
                            </button>
                          ))}
                      </div>
                      <p className="text-xs text-ink/45">
                        Every email includes a one-click unsubscribe link automatically — recipients
                        are checked against your suppression list before each send.
                      </p>
                    </>
                  )}

                  {step.kind === "condition" && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Select
                        label="Field"
                        value={String(step.conditions.field ?? "has_email")}
                        onChange={(e) =>
                          update(index, { conditions: { ...step.conditions, field: e.target.value } })
                        }
                      >
                        <option value="has_email">Has email</option>
                        <option value="has_phone">Has phone</option>
                        <option value="has_website">Has website</option>
                        <option value="email_status">Email status</option>
                        <option value="rating">Rating</option>
                        <option value="review_count">Review count</option>
                      </Select>
                      <Select
                        label="Operator"
                        value={String(step.conditions.operator ?? "eq")}
                        onChange={(e) =>
                          update(index, {
                            conditions: { ...step.conditions, operator: e.target.value },
                          })
                        }
                      >
                        <option value="eq">equals</option>
                        <option value="neq">not equals</option>
                        <option value="gt">greater than</option>
                        <option value="lt">less than</option>
                      </Select>
                      <Input
                        label="Value"
                        value={String(step.conditions.value ?? "")}
                        onChange={(e) =>
                          update(index, { conditions: { ...step.conditions, value: e.target.value } })
                        }
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {steps.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/45">
            No steps yet. Add an email step to get started.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Sending rules</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input
            label="Daily send limit"
            type="number"
            min={1}
            max={2000}
            value={limit}
            onChange={(e) => setLimit(Math.min(2000, Math.max(1, Number(e.target.value) || 1)))}
          />
          <Input label="Sending timezone" value={tz} onChange={(e) => setTz(e.target.value)} />
          <label className="flex items-center gap-2.5 self-end pb-3 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={stop}
              onChange={(e) => setStop(e.target.checked)}
              className="h-4 w-4 rounded border-ink/25 accent-ink"
            />
            Stop sequence on reply
          </label>
        </div>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="lime" onClick={save} disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving…" : "Save sequence"}
        </Button>
        {saved && !pending && (
          <span className="font-mono text-[11px] text-ink/45">Saved</span>
        )}
      </div>
    </div>
  );
}

function blankEmailStep(): CampaignStep {
  return {
    kind: "email",
    subject: "Quick question about {{business_name}}",
    body: DEFAULT_BODY,
    delayMinutes: 0,
    conditions: {},
  };
}

function describeDelay(minutes: number): string {
  if (minutes === 0) return "immediately";
  if (minutes < 60) return `after ${minutes}m`;
  if (minutes < 1440) return `after ${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
  return `after ${(minutes / 1440).toFixed(minutes % 1440 === 0 ? 0 : 1)}d`;
}
