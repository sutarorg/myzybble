"use client";

/**
 * Trigger → Conditions → Actions rule builder.
 *
 * Editing is local; the server re-validates the whole rule with zod on save.
 * Execution happens server-side in `runAutomations` with a per-event
 * idempotency key, so a replayed event can't run the same action twice.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Modal, Badge, EmptyState } from "@/components/app/primitives";
import { Workflow, Plus, Trash2, Save, Zap, Filter, Play } from "lucide-react";

export type TriggerType =
  | "search_completed"
  | "lead_created"
  | "lead_added_to_list"
  | "campaign_completed";

export type ConditionField =
  | "email_status"
  | "has_email"
  | "has_phone"
  | "has_website"
  | "rating"
  | "review_count"
  | "city"
  | "category"
  | "lead_score";

export type Operator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";

export type ActionType = "add_to_list" | "add_to_campaign" | "add_tag" | "notify";

export interface Condition {
  field: ConditionField;
  operator: Operator;
  value: string;
}

export interface Action {
  type: ActionType;
  listId?: string;
  campaignId?: string;
  tag?: string;
  message?: string;
}

export interface AutomationDraft {
  name: string;
  description: string;
  trigger: { type: TriggerType; config: Record<string, unknown> };
  conditions: Condition[];
  actions: Action[];
  status: "draft" | "active" | "paused";
}

export interface Option {
  id: string;
  name: string;
}

const TRIGGERS: { value: TriggerType; label: string; hint: string }[] = [
  {
    value: "search_completed",
    label: "Search completed",
    hint: "Runs once per lead produced by a finished search.",
  },
  { value: "lead_created", label: "Lead created", hint: "Runs for every new lead." },
  {
    value: "lead_added_to_list",
    label: "Lead added to a list",
    hint: "Runs when someone adds a lead to the selected list.",
  },
  {
    value: "campaign_completed",
    label: "Campaign completed",
    hint: "Runs once when a campaign finishes.",
  },
];

const FIELDS: { value: ConditionField; label: string }[] = [
  { value: "email_status", label: "Email status" },
  { value: "has_email", label: "Has email" },
  { value: "has_phone", label: "Has phone" },
  { value: "has_website", label: "Has website" },
  { value: "rating", label: "Rating" },
  { value: "review_count", label: "Review count" },
  { value: "city", label: "City" },
  { value: "category", label: "Category" },
  { value: "lead_score", label: "Lead score" },
];

const OPERATORS: { value: Operator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "at least" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "at most" },
  { value: "contains", label: "contains" },
];

const ACTIONS: { value: ActionType; label: string }[] = [
  { value: "add_to_list", label: "Add to list" },
  { value: "add_to_campaign", label: "Add to campaign" },
  { value: "add_tag", label: "Add tag" },
  { value: "notify", label: "Send notification" },
];

export function AutomationForm({
  open,
  onClose,
  initial,
  lists,
  campaigns,
}: {
  open: boolean;
  onClose: () => void;
  initial?: AutomationDraft & { id?: string };
  lists: Option[];
  campaigns: Option[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<AutomationDraft>(
    initial ?? {
      name: "",
      description: "",
      trigger: { type: "search_completed", config: {} },
      conditions: [],
      actions: [{ type: "add_tag", tag: "" }],
      status: "draft",
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // The server validates again; these checks just give instant feedback.
    if (draft.actions.length === 0) {
      setError("Add at least one action.");
      return;
    }
    for (const action of draft.actions) {
      if (action.type === "add_to_list" && !action.listId) {
        setError("Pick a list for the “add to list” action.");
        return;
      }
      if (action.type === "add_to_campaign" && !action.campaignId) {
        setError("Pick a campaign for the “add to campaign” action.");
        return;
      }
      if (action.type === "add_tag" && !action.tag?.trim()) {
        setError("Enter a tag for the “add tag” action.");
        return;
      }
      if (action.type === "notify" && !action.message?.trim()) {
        setError("Enter a message for the notification action.");
        return;
      }
    }

    start(async () => {
      const payload = {
        name: draft.name,
        description: draft.description || null,
        status: draft.status,
        trigger: draft.trigger,
        conditions: draft.conditions.map((c) => ({ ...c, value: coerceValue(c) })),
        actions: draft.actions,
      };

      const res = initial?.id
        ? await fetch(`/api/automations/${initial.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/automations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not save that automation.");
        return;
      }
      onClose();
      router.push(`/automations/${body.automation.id}`);
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? "Edit automation" : "New automation"}>
      <form onSubmit={submit} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <Input
          label="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Tag high-rated dentists"
          required
          maxLength={160}
        />
        <Input
          label="Description (optional)"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          maxLength={1000}
        />

        <fieldset className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
          <legend className="flex items-center gap-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">
            <Zap className="h-3 w-3" /> Trigger
          </legend>
          <Select
            label="When this happens"
            value={draft.trigger.type}
            onChange={(e) =>
              setDraft({
                ...draft,
                trigger: { type: e.target.value as TriggerType, config: draft.trigger.config },
              })
            }
          >
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-ink/50">
            {TRIGGERS.find((t) => t.value === draft.trigger.type)?.hint}
          </p>

          {draft.trigger.type === "lead_added_to_list" && (
            <div className="mt-3">
              <Select
                label="List"
                value={String(draft.trigger.config.listId ?? "")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    trigger: { ...draft.trigger, config: { listId: e.target.value } },
                  })
                }
              >
                <option value="">Any list</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
          <legend className="flex items-center gap-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">
            <Filter className="h-3 w-3" /> Conditions
          </legend>
          <p className="mb-3 text-xs text-ink/50">
            All conditions must match. With no conditions, every lead qualifies.
          </p>
          <div className="space-y-2">
            {draft.conditions.map((condition, index) => (
              <div key={index} className="flex items-start gap-2">
                <Select
                  value={condition.field}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      conditions: draft.conditions.map((c, i) =>
                        i === index ? { ...c, field: e.target.value as ConditionField } : c,
                      ),
                    })
                  }
                >
                  {FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={condition.operator}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      conditions: draft.conditions.map((c, i) =>
                        i === index ? { ...c, operator: e.target.value as Operator } : c,
                      ),
                    })
                  }
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Input
                  value={condition.value}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      conditions: draft.conditions.map((c, i) =>
                        i === index ? { ...c, value: e.target.value } : c,
                      ),
                    })
                  }
                  placeholder="value"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      conditions: draft.conditions.filter((_, i) => i !== index),
                    })
                  }
                  aria-label="Remove condition"
                  className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink/40 hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            onClick={() =>
              setDraft({
                ...draft,
                conditions: [
                  ...draft.conditions,
                  { field: "rating", operator: "gte", value: "4" },
                ],
              })
            }
            disabled={draft.conditions.length >= 20}
          >
            <Plus className="h-3.5 w-3.5" /> Add condition
          </Button>
        </fieldset>

        <fieldset className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
          <legend className="flex items-center gap-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">
            <Play className="h-3 w-3" /> Actions
          </legend>
          <div className="space-y-3">
            {draft.actions.map((action, index) => (
              <div key={index} className="flex items-start gap-2">
                <Select
                  value={action.type}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      actions: draft.actions.map((a, i) =>
                        i === index
                          ? { ...a, type: e.target.value as ActionType }
                          : a,
                      ),
                    })
                  }
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </Select>

                {action.type === "add_to_list" && (
                  <Select
                    value={action.listId ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        actions: draft.actions.map((a, i) =>
                          i === index ? { ...a, listId: e.target.value } : a,
                        ),
                      })
                    }
                  >
                    <option value="">Select a list…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                )}

                {action.type === "add_to_campaign" && (
                  <Select
                    value={action.campaignId ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        actions: draft.actions.map((a, i) =>
                          i === index ? { ...a, campaignId: e.target.value } : a,
                        ),
                      })
                    }
                  >
                    <option value="">Select a campaign…</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}

                {action.type === "add_tag" && (
                  <Input
                    value={action.tag ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        actions: draft.actions.map((a, i) =>
                          i === index ? { ...a, tag: e.target.value } : a,
                        ),
                      })
                    }
                    placeholder="high-rated"
                    maxLength={60}
                  />
                )}

                {action.type === "notify" && (
                  <Input
                    value={action.message ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        actions: draft.actions.map((a, i) =>
                          i === index ? { ...a, message: e.target.value } : a,
                        ),
                      })
                    }
                    placeholder="New qualified lead added"
                    maxLength={300}
                  />
                )}

                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, actions: draft.actions.filter((_, i) => i !== index) })
                  }
                  disabled={draft.actions.length <= 1}
                  aria-label="Remove action"
                  className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink/40 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            onClick={() =>
              setDraft({ ...draft, actions: [...draft.actions, { type: "add_tag", tag: "" }] })
            }
            disabled={draft.actions.length >= 10}
          >
            <Plus className="h-3.5 w-3.5" /> Add action
          </Button>
        </fieldset>

        <Select
          label="Status"
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as AutomationDraft["status"] })
          }
        >
          <option value="draft">Draft — won&apos;t run</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </Select>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="lime" disabled={pending || draft.name.trim().length === 0}>
            <Save className="h-3.5 w-3.5" />
            {pending ? "Saving…" : "Save automation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AutomationList({
  automations,
  lists,
  campaigns,
}: {
  automations: (AutomationDraft & {
    id: string;
    runsCount: number;
    lastRunAt: string | null;
  })[];
  lists: Option[];
  campaigns: Option[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (automations.length === 0) {
    return (
      <>
        <EmptyState
          icon={Workflow}
          title="No automations yet"
          body="Automations react to events in your workspace — tag every 4★+ lead from a search, add new leads to a campaign, or notify your team."
          action={
            <Button variant="lime" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New automation
            </Button>
          }
        />
        <AutomationForm open={open} onClose={() => setOpen(false)} lists={lists} campaigns={campaigns} />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button variant="lime" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New automation
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {automations.map((automation) => (
          <Card key={automation.id}>
            <div className="flex items-start justify-between gap-3">
              <a
                href={`/automations/${automation.id}`}
                className="min-w-0 truncate font-display text-lg font-bold tracking-tight hover:underline"
              >
                {automation.name}
              </a>
              <Badge
                tone={
                  automation.status === "active"
                    ? "lime"
                    : automation.status === "paused"
                      ? "amber"
                      : "neutral"
                }
              >
                {automation.status}
              </Badge>
            </div>
            {automation.description && (
              <p className="mt-1 line-clamp-2 text-sm text-ink/55">{automation.description}</p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/8 pt-4">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">
                  Trigger
                </dt>
                <dd className="mt-0.5 text-sm">
                  {TRIGGERS.find((t) => t.value === automation.trigger.type)?.label ??
                    automation.trigger.type}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">
                  Runs
                </dt>
                <dd className="mt-0.5 font-display text-lg font-bold">
                  {automation.runsCount.toLocaleString()}
                </dd>
              </div>
            </dl>

            <p className="mt-3 font-mono text-[11px] text-ink/40">
              {automation.conditions.length} condition
              {automation.conditions.length === 1 ? "" : "s"} ·{" "}
              {automation.actions.length} action{automation.actions.length === 1 ? "" : "s"}
              {automation.lastRunAt
                ? ` · last run ${new Date(automation.lastRunAt).toLocaleDateString()}`
                : " · never run"}
            </p>
          </Card>
        ))}
      </div>

      <AutomationForm
        open={open}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
        lists={lists}
        campaigns={campaigns}
      />
    </>
  );
}

/** Numbers and booleans are sent as their real types, not strings. */
function coerceValue(condition: Condition): unknown {
  if (condition.field === "has_email" || condition.field === "has_phone" || condition.field === "has_website") {
    return condition.value === "true" || condition.value === "1";
  }
  if (condition.field === "rating" || condition.field === "review_count" || condition.field === "lead_score") {
    const n = Number(condition.value);
    return Number.isFinite(n) ? n : 0;
  }
  return condition.value;
}
