import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { AutomationRow } from "@/types/database";
import { addLeadsToList } from "@/server/services/lists";
import { bulkTag } from "@/server/services/leads";
import { createNotification } from "@/server/services/notifications";

/**
 * Automation engine (§24): Trigger → Conditions → Actions.
 *
 * Execution is always server/worker controlled — never in the browser. Every run
 * is recorded in `automation_runs` with an idempotency key, so replaying a
 * trigger (e.g. a retried webhook or a repeated job event) can never apply the
 * same action twice.
 */

type TriggerType =
  | "search_completed"
  | "lead_created"
  | "lead_added_to_list"
  | "campaign_completed";

interface Condition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}

interface Action {
  type: "add_to_list" | "add_to_campaign" | "add_tag" | "notify";
  params: Record<string, unknown>;
}

export interface RunAutomationsInput {
  workspaceId: string;
  triggerType: TriggerType;
  idempotencyKey: string;
  subject: Record<string, unknown>;
}

export async function runAutomations(input: RunAutomationsInput): Promise<number> {
  const admin = createAdminClient();

  const { data: automations, error } = await admin
    .from("automations")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (error || !automations || automations.length === 0) return 0;

  const matching = (automations as AutomationRow[]).filter(
    (a) => (a.trigger as { type?: string })?.type === input.triggerType,
  );

  let executed = 0;

  for (const automation of matching) {
    // Idempotency: one row per (automation, trigger instance) enforced by a
    // unique index, so a duplicate trigger inserts nothing and returns early.
    const { data: run, error: runError } = await admin
      .from("automation_runs")
      .insert({
        automation_id: automation.id,
        workspace_id: input.workspaceId,
        trigger_event: input.triggerType,
        idempotency_key: input.idempotencyKey,
        subject: input.subject as never,
        status: "running",
      } as never)
      .select("id")
      .maybeSingle();

    if (runError) {
      if (runError.code === "23505") continue; // already ran
      logger.warn("automation.run_insert_failed", {
        workspace_id: input.workspaceId,
        event: "automation.run",
        status: "error",
        error_code: runError.code,
      });
      continue;
    }

    const runId: string | null = (run as { id: string } | null)?.id ?? null;

    try {
      const subjects = await resolveSubjects(admin, automation, input);
      const conditionsMet = subjects.filter((lead) =>
        evaluateConditions(lead, ((automation.conditions ?? []) as unknown as Condition[])),
      );

      const applied: unknown[] = [];
      for (const action of ((automation.actions ?? []) as unknown as Action[])) {
        const result = await applyAction(admin, action, conditionsMet, input.workspaceId);
        applied.push({ type: action.type, ...result });
      }

      await admin
        .from("automation_runs")
        .update({
          status: "succeeded",
          conditions_met: conditionsMet.length > 0,
          actions_run: applied as never,
          finished_at: new Date().toISOString(),
        } as never)
        .eq("id", runId ?? "");

      await admin
        .from("automations")
        .update({
          runs_count: automation.runs_count + 1,
          last_run_at: new Date().toISOString(),
        } as never)
        .eq("id", automation.id);

      executed += 1;
    } catch (error) {
      await admin
        .from("automation_runs")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          finished_at: new Date().toISOString(),
        } as never)
        .eq("id", runId ?? "");

      logger.error("automation.run_failed", {
        workspace_id: input.workspaceId,
        event: "automation.run",
        status: "error",
        error_message: error instanceof Error ? error.message : String(error),
        metadata: { automation_id: automation.id },
      });
    }
  }

  return executed;
}

interface SubjectLead {
  id: string;
  workspace_id: string;
  business_name: string;
  primary_email: string | null;
  primary_phone: string | null;
  website: string | null;
  email_status: string;
  rating: number | null;
  review_count: number | null;
  city: string | null;
  category: string | null;
  lead_score: number;
}

/** Resolves which leads an automation instance should evaluate. */
async function resolveSubjects(
  admin: ReturnType<typeof createAdminClient>,
  automation: AutomationRow,
  input: RunAutomationsInput,
): Promise<SubjectLead[]> {
  const trigger = automation.trigger as { type?: string; config?: Record<string, unknown> };
  const config = trigger.config ?? {};

  if (input.triggerType === "search_completed") {
    const jobId = String(input.subject.jobId ?? "");
    if (!jobId) return [];
    const { data } = await admin
      .from("leads")
      .select("id, workspace_id, business_name, primary_email, primary_phone, website, email_status, rating, review_count, city, category, lead_score")
      .eq("source_job_id", jobId)
      .is("deleted_at", null)
      .limit(10_000);
    return (data as SubjectLead[] | null) ?? [];
  }

  if (input.triggerType === "lead_created") {
    const leadId = String(input.subject.leadId ?? "");
    if (!leadId) return [];
    const { data } = await admin
      .from("leads")
      .select("id, workspace_id, business_name, primary_email, primary_phone, website, email_status, rating, review_count, city, category, lead_score")
      .eq("id", leadId)
      .maybeSingle();
    return data ? [data as SubjectLead] : [];
  }

  if (input.triggerType === "lead_added_to_list") {
    const listId = String(config.listId ?? input.subject.listId ?? "");
    if (!listId) return [];
    const { data: members } = await admin
      .from("list_members")
      .select("lead_id")
      .eq("list_id", listId);
    const ids = ((members ?? []) as { lead_id: string }[]).map((m) => m.lead_id);
    if (ids.length === 0) return [];
    const { data } = await admin
      .from("leads")
      .select("id, workspace_id, business_name, primary_email, primary_phone, website, email_status, rating, review_count, city, category, lead_score")
      .in("id", ids)
      .is("deleted_at", null);
    return (data as SubjectLead[] | null) ?? [];
  }

  return [];
}

/** Pure condition evaluator — also exercised directly by unit tests. */
export function evaluateConditions(lead: SubjectLead, conditions: Condition[]): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((condition) => {
    const actual = fieldValue(lead, condition.field);

    switch (condition.operator) {
      case "eq":
        return looseEquals(actual, condition.value);
      case "neq":
        return !looseEquals(actual, condition.value);
      case "gt":
        return numeric(actual) > numeric(condition.value);
      case "gte":
        return numeric(actual) >= numeric(condition.value);
      case "lt":
        return numeric(actual) < numeric(condition.value);
      case "lte":
        return numeric(actual) <= numeric(condition.value);
      case "in":
        return Array.isArray(condition.value)
          ? condition.value.some((v) => looseEquals(actual, v))
          : looseEquals(actual, condition.value);
      case "contains":
        return String(actual ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase());
      default:
        return false;
    }
  });
}

function fieldValue(lead: SubjectLead, field: string): unknown {
  switch (field) {
    case "email_status":
      return lead.email_status;
    case "has_email":
      return Boolean(lead.primary_email);
    case "has_phone":
      return Boolean(lead.primary_phone);
    case "has_website":
      return Boolean(lead.website);
    case "rating":
      return lead.rating;
    case "review_count":
      return lead.review_count;
    case "city":
      return lead.city;
    case "category":
      return lead.category;
    case "lead_score":
      return lead.lead_score;
    default:
      return undefined;
  }
}

function numeric(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    return Boolean(a) === (b === true || b === "true");
  }
  if (a === null || a === undefined) return b === null || b === undefined || b === "";
  return String(a).toLowerCase() === String(b).toLowerCase();
}

async function applyAction(
  admin: ReturnType<typeof createAdminClient>,
  action: Action,
  leads: SubjectLead[],
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const ids = leads.map((l) => l.id);
  if (ids.length === 0) return { applied: 0, skipped: true };

  switch (action.type) {
    case "add_to_list": {
      const listId = String(action.params.listId ?? "");
      if (!listId) return { applied: 0, error: "missing_list_id" };
      const count = await addLeadsToList(workspaceId, listId, ids);
      return { applied: count, listId };
    }
    case "add_tag": {
      const tag = String(action.params.tag ?? "").trim();
      if (!tag) return { applied: 0, error: "missing_tag" };
      const count = await bulkTag(workspaceId, ids, tag);
      return { applied: count, tag };
    }
    case "add_to_campaign": {
      const campaignId = String(action.params.campaignId ?? "");
      if (!campaignId) return { applied: 0, error: "missing_campaign_id" };
      const { addLeadsToCampaign } = await import("@/server/services/campaigns");
      const result = await addLeadsToCampaign({ workspaceId, campaignId, leadIds: ids });
      return { applied: result.added, skipped: result.skipped, campaignId };
    }
    case "notify": {
      await createNotification({
        workspaceId,
        type: "system",
        title: String(action.params.title ?? "Automation ran"),
        body: String(action.params.body ?? `${ids.length} leads matched your automation conditions.`),
        severity: "info",
        dedupeKey: `automation_notify:${workspaceId}:${Date.now()}`,
      });
      return { applied: ids.length, notified: true };
    }
    default:
      return { applied: 0, error: "unknown_action" };
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listAutomations(workspaceId: string): Promise<AutomationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as AutomationRow[] | null) ?? [];
}

export async function getAutomation(workspaceId: string, id: string): Promise<AutomationRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as AutomationRow | null) ?? null;
}

export async function createAutomation(
  workspaceId: string,
  userId: string,
  input: { name: string; description?: string | null; trigger: unknown; conditions: unknown; actions: unknown; status?: "draft" | "active" | "paused" },
): Promise<AutomationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "draft",
      trigger: input.trigger as never,
      conditions: (input.conditions ?? []) as never,
      actions: input.actions as never,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error("Could not create that automation.");
  return data as AutomationRow;
}

export async function updateAutomation(
  workspaceId: string,
  id: string,
  patch: Partial<Pick<AutomationRow, "name" | "description" | "status" | "trigger" | "conditions" | "actions">>,
): Promise<AutomationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  if (error) throw new Error("Could not update that automation.");
  return data as AutomationRow;
}

export async function deleteAutomation(workspaceId: string, id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("automations")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("workspace_id", workspaceId);
}

export async function listAutomationRuns(workspaceId: string, automationId: string, limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("automation_id", automationId)
    .eq("workspace_id", workspaceId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
