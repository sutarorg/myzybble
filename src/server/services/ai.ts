import "server-only";
import { GoogleGenAI, Type, type FunctionDeclaration, type Content } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { AiMessageRow } from "@/types/database";
import { listLeads } from "@/server/services/leads";
import { getEntitlements } from "@/server/services/usage";
import { createSearch } from "@/server/services/searches";
import { createList, addLeadsToList } from "@/server/services/lists";

/**
 * Gemini-powered AI Assistant (§20).
 *
 * Ground rules enforced here:
 *  - The API key is server-only; the browser only ever sees our own route.
 *  - The model can only report business data it actually read through a tool.
 *    The system prompt forbids recalling or guessing facts about businesses.
 *  - Actions that spend quota or send email require explicit confirmation; the
 *    model may *propose* them, and the UI turns the proposal into a real
 *    confirmation step before anything runs.
 *
 * Model selection: resolved at runtime with a fallback chain so a deprecated
 * model id degrades to the next supported one instead of hard-failing.
 */

const MODEL_FALLBACK_CHAIN = [
  serverEnv.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

let aiClient: GoogleGenAI | null = null;

function genai(): GoogleGenAI {
  if (aiClient) return aiClient;
  if (!serverEnv.GEMINI_API_KEY) {
    throw Errors.dependency(
      "GEMINI_API_KEY is not configured. Add it in your Vercel environment variables.",
    );
  }
  aiClient = new GoogleGenAI({ apiKey: serverEnv.GEMINI_API_KEY });
  return aiClient;
}

export function isAiConfigured(): boolean {
  return Boolean(serverEnv.GEMINI_API_KEY);
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                      */
/* -------------------------------------------------------------------------- */

export interface ToolContext {
  workspaceId: string;
  userId: string;
  /** Actions that cost money or send email are staged, not executed. */
  pendingActions: PendingAction[];
}

export interface PendingAction {
  id: string;
  type: "create_search" | "create_list" | "create_campaign" | "add_to_list";
  label: string;
  params: Record<string, unknown>;
  reason: string;
}

const searchLeadsTool: FunctionDeclaration = {
  name: "search_leads",
  description:
    "Search the user's stored leads by text query and optional filters. Use this for ANY question about businesses, leads or contacts — never answer from memory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Free-text search over business name, category, city and address." },
      city: { type: Type.STRING },
      category: { type: Type.STRING },
      hasEmail: { type: Type.BOOLEAN },
      hasPhone: { type: Type.BOOLEAN },
      minRating: { type: Type.NUMBER },
      emailStatus: {
        type: Type.STRING,
        enum: ["unknown", "pending", "valid", "invalid", "risky", "accept_all", "disposable", "suppressed"],
      },
      limit: { type: Type.NUMBER, description: "Max results, 1-50. Default 20." },
    },
    required: [],
  },
};

const getLeadTool: FunctionDeclaration = {
  name: "get_lead",
  description: "Fetch one stored lead with all of its contact details.",
  parameters: {
    type: Type.OBJECT,
    properties: { leadId: { type: Type.STRING } },
    required: ["leadId"],
  },
};

const filterLeadsTool: FunctionDeclaration = {
  name: "filter_leads",
  description: "Filter stored leads with structured criteria and return matching rows.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      city: { type: Type.STRING },
      category: { type: Type.STRING },
      minRating: { type: Type.NUMBER },
      minReviewCount: { type: Type.NUMBER },
      minScore: { type: Type.NUMBER },
      hasEmail: { type: Type.BOOLEAN },
      hasPhone: { type: Type.BOOLEAN },
      hasWebsite: { type: Type.BOOLEAN },
      limit: { type: Type.NUMBER },
    },
    required: [],
  },
};

const getListTool: FunctionDeclaration = {
  name: "get_list",
  description: "List the user's saved lists with their lead counts.",
  parameters: { type: Type.OBJECT, properties: {} },
};

const getUsageTool: FunctionDeclaration = {
  name: "get_usage",
  description: "Report current plan, monthly lead quota, usage and remaining allowance.",
  parameters: { type: Type.OBJECT, properties: {} },
};

const getSubscriptionTool: FunctionDeclaration = {
  name: "get_subscription",
  description: "Report the workspace's subscription status and billing period.",
  parameters: { type: Type.OBJECT, properties: {} },
};

const proposeSearchTool: FunctionDeclaration = {
  name: "propose_search",
  description:
    "Stage a new Google Maps search for the user to confirm. Does not run immediately — the user must approve it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      locations: { type: Type.ARRAY, items: { type: Type.STRING } },
      requestedLimit: { type: Type.NUMBER },
      minRating: { type: Type.NUMBER },
      requireEmail: { type: Type.BOOLEAN },
      requirePhone: { type: Type.BOOLEAN },
      requireWebsite: { type: Type.BOOLEAN },
    },
    required: ["keywords", "locations"],
  },
};

const createListTool: FunctionDeclaration = {
  name: "create_list",
  description: "Create a new saved list of leads.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      leadIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["name"],
  },
};

const getAnalysisTool: FunctionDeclaration = {
  name: "summarise_leads",
  description: "Compute aggregate statistics over the user's stored leads (counts, averages, coverage).",
  parameters: { type: Type.OBJECT, properties: {} },
};

const TOOLS: FunctionDeclaration[] = [
  searchLeadsTool,
  getLeadTool,
  filterLeadsTool,
  getListTool,
  getUsageTool,
  getSubscriptionTool,
  proposeSearchTool,
  createListTool,
  getAnalysisTool,
];

/* -------------------------------------------------------------------------- */
/* Tool execution                                                             */
/* -------------------------------------------------------------------------- */

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const supabase = await createClient();

  switch (name) {
    case "search_leads": {
      const { leads, total } = await listLeads(ctx.workspaceId, {
        q: typeof args.query === "string" ? args.query : undefined,
        city: typeof args.city === "string" ? args.city : undefined,
        category: typeof args.category === "string" ? args.category : undefined,
        hasEmail: typeof args.hasEmail === "boolean" ? args.hasEmail : undefined,
        hasPhone: typeof args.hasPhone === "boolean" ? args.hasPhone : undefined,
        minRating: typeof args.minRating === "number" ? args.minRating : undefined,
        emailStatus: typeof args.emailStatus === "string" ? (args.emailStatus as never) : undefined,
        sort: "recent",
        direction: "desc",
        limit: clampLimit(args.limit, 20),
      });
      return {
        source: "stored_data",
        count: leads.length,
        totalEstimate: total,
        leads: leads.map(trimLead),
      };
    }

    case "filter_leads": {
      const { leads, total } = await listLeads(ctx.workspaceId, {
        city: typeof args.city === "string" ? args.city : undefined,
        category: typeof args.category === "string" ? args.category : undefined,
        minRating: typeof args.minRating === "number" ? args.minRating : undefined,
        minReviewCount: typeof args.minReviewCount === "number" ? args.minReviewCount : undefined,
        minScore: typeof args.minScore === "number" ? args.minScore : undefined,
        hasEmail: typeof args.hasEmail === "boolean" ? args.hasEmail : undefined,
        hasPhone: typeof args.hasPhone === "boolean" ? args.hasPhone : undefined,
        hasWebsite: typeof args.hasWebsite === "boolean" ? args.hasWebsite : undefined,
        sort: "score",
        direction: "desc",
        limit: clampLimit(args.limit, 25),
      });
      return { source: "stored_data", count: leads.length, totalEstimate: total, leads: leads.map(trimLead) };
    }

    case "get_lead": {
      const leadId = String(args.leadId ?? "");
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .eq("workspace_id", ctx.workspaceId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!data) return { source: "stored_data", found: false };
      const [emails, phones] = await Promise.all([
        supabase.from("lead_emails").select("email, status, confidence, reason").eq("lead_id", leadId),
        supabase.from("lead_phones").select("e164, raw, kind").eq("lead_id", leadId),
      ]);
      return { source: "stored_data", found: true, lead: data, emails: emails.data ?? [], phones: phones.data ?? [] };
    }

    case "get_list": {
      const { data } = await supabase
        .from("lists")
        .select("id, name, description, list_members(count)")
        .eq("workspace_id", ctx.workspaceId)
        .is("deleted_at", null)
        .limit(100);
      return {
        source: "stored_data",
        lists: ((data ?? []) as unknown as { id: string; name: string; list_members: { count: number }[] }[]).map(
          ({ list_members, ...l }) => ({ ...l, member_count: list_members?.[0]?.count ?? 0 }),
        ),
      };
    }

    case "get_usage": {
      const snapshot = await getEntitlements(ctx.workspaceId);
      return { source: "stored_data", ...snapshot };
    }

    case "get_subscription": {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, currency, current_period_start, current_period_end, cancel_at_period_end, plan:plans(name, price_cents, monthly_leads)")
        .eq("workspace_id", ctx.workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { source: "stored_data", subscription: data ?? null };
    }

    case "propose_search": {
      // Staged: the user must confirm before any quota is spent (§20).
      const action: PendingAction = {
        id: `act_${crypto.randomUUID().slice(0, 8)}`,
        type: "create_search",
        label: `Search ${(args.keywords as string[] | undefined)?.join(", ") ?? "leads"} in ${
          (args.locations as string[] | undefined)?.join(", ") ?? "—"
        }`,
        params: {
          keywords: args.keywords,
          locations: args.locations,
          requestedLimit: args.requestedLimit ?? 100,
          minRating: args.minRating ?? null,
          requireEmail: args.requireEmail ?? false,
          requirePhone: args.requirePhone ?? false,
          requireWebsite: args.requireWebsite ?? false,
        },
        reason: "This will run a Google Maps scrape and consume lead quota.",
      };
      ctx.pendingActions.push(action);
      return {
        source: "model",
        staged: true,
        actionId: action.id,
        message: "Search staged. The user must confirm before it runs.",
      };
    }

    case "create_list": {
      const name = String(args.name ?? "").trim();
      if (!name) return { source: "model", error: "A list name is required." };
      const list = await createList(ctx.workspaceId, ctx.userId, { name });
      const leadIds = Array.isArray(args.leadIds) ? (args.leadIds as string[]).slice(0, 5_000) : [];
      if (leadIds.length) await addLeadsToList(ctx.workspaceId, list.id, leadIds);
      return { source: "stored_data", created: true, listId: list.id, name: list.name, added: leadIds.length };
    }

    case "summarise_leads": {
      const { leads } = await listLeads(ctx.workspaceId, { sort: "recent", direction: "desc", limit: 200 });
      const withEmail = leads.filter((l) => l.primary_email).length;
      const withPhone = leads.filter((l) => l.primary_phone).length;
      const withWebsite = leads.filter((l) => l.website).length;
      const ratings = leads.map((l) => l.rating).filter((r): r is number => typeof r === "number");
      const cities = new Map<string, number>();
      const categories = new Map<string, number>();
      for (const lead of leads) {
        if (lead.city) cities.set(lead.city, (cities.get(lead.city) ?? 0) + 1);
        if (lead.category) categories.set(lead.category, (categories.get(lead.category) ?? 0) + 1);
      }
      return {
        source: "stored_data",
        sampleSize: leads.length,
        coverage: {
          email: pct(withEmail, leads.length),
          phone: pct(withPhone, leads.length),
          website: pct(withWebsite, leads.length),
        },
        averageRating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : null,
        topCities: [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
        topCategories: [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
        note: "Computed over the most recent 200 leads; larger sets should be exported for exact figures.",
      };
    }

    default:
      return { source: "model", error: `Unknown tool: ${name}` };
  }
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function clampLimit(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : fallback;
  return Math.max(1, Math.min(50, Math.round(n)));
}

/** Keeps tool payloads small: only fields the model needs to reason. */
function trimLead(lead: {
  id: string;
  business_name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  rating: number | null;
  review_count: number | null;
  primary_email: string | null;
  primary_phone: string | null;
  email_status: string;
  website: string | null;
  lead_score: number;
  maps_url: string | null;
}) {
  return {
    id: lead.id,
    name: lead.business_name,
    category: lead.category,
    city: lead.city,
    state: lead.state,
    rating: lead.rating,
    reviewCount: lead.review_count,
    email: lead.primary_email,
    phone: lead.primary_phone,
    emailStatus: lead.email_status,
    website: lead.website,
    score: lead.lead_score,
    mapsUrl: lead.maps_url,
  };
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */

const SYSTEM_INSTRUCTION = `You are the zybble AI Assistant, embedded in a lead-generation product.

HARD RULES — never break these:
1. NEVER invent, guess, recall or estimate facts about real businesses. Every business
   fact you state must come from a tool result returned in this conversation. If a tool
   didn't return it, say you don't have it.
2. Clearly separate four kinds of content in your replies:
   - "Stored data" — values returned by tools. Quote them exactly.
   - "Analysis" — your own reasoning over that data. Label it as analysis.
   - "Draft copy" — outreach text you generate. Label it as a draft for review.
   - "Unknown" — anything you could not retrieve. Say "I don't have that" plainly.
3. You may stage expensive actions (running a Google Maps search, creating a campaign)
   but you must NEVER claim they ran. Staged actions return an actionId; ask the user to
   confirm and explain the cost in leads.
4. Never claim an email is verified unless its status is literally "valid". An address
   existing is not evidence that it works.
5. Be concise and concrete. Prefer short bullet lists and real numbers over prose.
6. You have no browsing access. If the user asks for live web data, offer to run a
   zybble search instead.`;

export interface ChatResult {
  conversationId: string;
  reply: string;
  pendingActions: PendingAction[];
  toolCalls: { name: string; args: Record<string, unknown>; result: unknown }[];
  model: string;
  latencyMs: number;
}

export async function runChat(params: {
  workspaceId: string;
  userId: string;
  conversationId?: string;
  message: string;
  context?: { leadId?: string; listId?: string; searchId?: string };
}): Promise<ChatResult> {
  const started = Date.now();
  const supabase = await createClient();
  const client = genai();

  // 1. Load or create the conversation (persistence, §20).
  let conversationId = params.conversationId;
  if (!conversationId) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        workspace_id: params.workspaceId,
        user_id: params.userId,
        title: params.message.slice(0, 60),
        model: MODEL_FALLBACK_CHAIN[0],
        context: (params.context ?? {}) as never,
      })
      .select("id")
      .single();
    if (error || !data) throw Errors.internal("Could not start a conversation.");
    conversationId = (data as { id: string }).id;
  }

  const { data: history } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  const prior = (history as AiMessageRow[] | null) ?? [];

  // 2. Persist the user's message.
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    workspace_id: params.workspaceId,
    role: "user",
    content: params.message,
    provenance: "user",
  } as never);

  const ctx: ToolContext = { workspaceId: params.workspaceId, userId: params.userId, pendingActions: [] };

  const contents: Content[] = [
    ...prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      })),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  // 3. Tool loop. The model may call several tools across several turns.
  const toolCalls: ChatResult["toolCalls"] = [];
  let finalText = "";
  let usedModel = MODEL_FALLBACK_CHAIN[0];
  let lastError: unknown = null;

  outer: for (const model of MODEL_FALLBACK_CHAIN) {
    usedModel = model;
    try {
      for (let turn = 0; turn < 6; turn += 1) {
        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: TOOLS }],
            temperature: 0.2,
            maxOutputTokens: 2_048,
          },
        });

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          for (const call of functionCalls) {
            const args = (call.args ?? {}) as Record<string, unknown>;
            let result: unknown;
            try {
              result = await executeTool(call.name ?? "", args, ctx);
            } catch (error) {
              result = {
                source: "model",
                error: "The tool failed. Tell the user something went wrong and suggest retrying.",
              };
              logger.error("ai.tool_failed", {
                workspace_id: params.workspaceId,
                event: "ai.tool",
                status: "error",
                error_message: error instanceof Error ? error.message : String(error),
                metadata: { tool: call.name },
              });
            }
            toolCalls.push({ name: call.name ?? "", args, result });

            contents.push({
              role: "model",
              parts: [{ functionCall: { name: call.name ?? "", args, id: call.id } }],
            });
            contents.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name ?? "",
                    response: { result: result as Record<string, unknown> },
                    id: call.id,
                  },
                },
              ],
            });
          }
          continue;
        }

        finalText = response.text ?? "";
        break;
      }
      lastError = null;
      break outer;
    } catch (error) {
      lastError = error;
      logger.warn("ai.model_failed", {
        workspace_id: params.workspaceId,
        event: "ai.chat",
        status: "retry",
        error_code: error instanceof Error ? error.name : "UnknownError",
        metadata: { model },
      });
      // Try the next model in the chain before giving up.
    }
  }

  if (lastError) {
    logger.error("ai.chat_failed", {
      workspace_id: params.workspaceId,
      event: "ai.chat",
      status: "error",
      error_message: lastError instanceof Error ? lastError.message : String(lastError),
    });
    throw Errors.provider("The AI assistant is temporarily unavailable. Please try again.");
  }

  if (!finalText) {
    finalText =
      "I couldn't produce a response for that. Try rephrasing, or ask me to search your leads for something specific.";
  }

  // 4. Persist the assistant reply and meter the request.
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    workspace_id: params.workspaceId,
    role: "assistant",
    content: finalText,
    provenance: "model",
    tool_calls: (toolCalls.length
      ? toolCalls.map((t) => ({ name: t.name, args: t.args }))
      : null) as never,
    tool_results: (toolCalls.length
      ? toolCalls.map((t) => ({ name: t.name, result: t.result }))
      : null) as never,
    latency_ms: Date.now() - started,
  } as never);

  await supabase
    .from("ai_conversations")
    .update({
      message_count: prior.length + 2,
      model: usedModel,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", conversationId);

  const { recordUsage } = await import("@/server/services/usage");
  await recordUsage({
    workspaceId: params.workspaceId,
    metric: "ai_requests",
    delta: 1,
    idempotencyKey: `ai:${conversationId}:${prior.length}`,
    userId: params.userId,
    metadata: { model: usedModel, tool_calls: toolCalls.length },
  });

  return {
    conversationId,
    reply: finalText,
    pendingActions: ctx.pendingActions,
    toolCalls,
    model: usedModel,
    latencyMs: Date.now() - started,
  };
}

/**
 * Executes a previously staged action after the user explicitly confirms.
 * This is the only path that can spend quota from the assistant (§20).
 */
export async function confirmPendingAction(params: {
  workspaceId: string;
  userId: string;
  action: PendingAction;
}): Promise<{ ok: true; result: unknown }> {
  if (params.action.type === "create_search") {
    const p = params.action.params as {
      keywords: string[];
      locations: string[];
      requestedLimit?: number;
      minRating?: number | null;
      requireEmail?: boolean;
      requirePhone?: boolean;
      requireWebsite?: boolean;
    };
    const result = await createSearch({
      workspaceId: params.workspaceId,
      userId: params.userId,
      input: {
        keywords: p.keywords,
        locations: p.locations,
        requestedLimit: p.requestedLimit ?? 100,
        language: "en",
        minRating: p.minRating ?? null,
        minReviewCount: null,
        requireWebsite: p.requireWebsite ?? false,
        requirePhone: p.requirePhone ?? false,
        requireEmail: p.requireEmail ?? false,
        businessStatus: "all",
        extraOptions: {},
      },
    });
    return { ok: true, result: { jobId: result.job.id, searchId: result.search.id } };
  }

  throw Errors.validation("That action can't be confirmed automatically.");
}

export async function listConversations(workspaceId: string, userId: string, limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, title, model, message_count, updated_at, archived_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getConversation(workspaceId: string, userId: string, conversationId: string) {
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conversation) return null;

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("id, role, content, provenance, tool_calls, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  return { conversation, messages: messages ?? [] };
}

/** Server-side admin helper used by the ops dashboard (§35). */
export async function aiUsageSummary(workspaceId: string) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("ai_messages")
    .select("id", { count: "estimated", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "assistant");
  return { assistantMessages: count ?? 0 };
}
