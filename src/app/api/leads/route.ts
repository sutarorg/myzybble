import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { listLeads, bulkTag, deleteLeads, markContacted, createManualLead, leadFacets } from "@/server/services/leads";
import { addLeadsToList, removeLeadsFromList } from "@/server/services/lists";
import { recordAudit } from "@/server/services/audit";
import { leadFiltersSchema, bulkLeadActionSchema } from "@/lib/validation";

const querySchema = leadFiltersSchema.partial().extend({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** GET /api/leads — server-side filtered, keyset-paginated lead list. */
export const GET = withRoute("GET /api/leads", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("leads:search", auth.user.id, ctx);

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const parsed = querySchema.safeParse({
    ...params,
    hasEmail: params.hasEmail === undefined ? undefined : params.hasEmail === "true",
    hasPhone: params.hasPhone === undefined ? undefined : params.hasPhone === "true",
    hasWebsite: params.hasWebsite === undefined ? undefined : params.hasWebsite === "true",
    contacted: params.contacted === undefined ? undefined : params.contacted === "true",
    minRating: params.minRating ? Number(params.minRating) : undefined,
    minReviewCount: params.minReviewCount ? Number(params.minReviewCount) : undefined,
    minScore: params.minScore ? Number(params.minScore) : undefined,
    tags: params.tags ? params.tags.split(",").filter(Boolean) : undefined,
    limit: params.limit ? Number(params.limit) : 50,
  });

  if (!parsed.success) {
    return json({ error: { code: "validation_error", message: "Invalid lead filters." } }, 422);
  }

  const result = await listLeads(auth.workspaceId, parsed.data);
  return json(result);
});

/** POST /api/leads/bulk — bulk operations (tag, list, delete, contacted). */
export const POST = withRoute("POST /api/leads", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("leads:search", auth.user.id, ctx);

  const url = new URL(request.url);

  // Manual lead creation is a separate, clearly-named action.
  if (url.searchParams.get("action") === "create") {
    const input = await readJson(
      request,
      z.object({
        businessName: z.string().trim().min(1).max(200),
        website: z.string().trim().max(500).nullish(),
        phone: z.string().trim().max(60).nullish(),
        email: z.string().trim().max(254).nullish(),
        address: z.string().trim().max(400).nullish(),
        city: z.string().trim().max(120).nullish(),
        state: z.string().trim().max(120).nullish(),
        country: z.string().trim().max(120).nullish(),
        category: z.string().trim().max(120).nullish(),
        notes: z.string().max(5_000).nullish(),
      }),
    );

    const lead = await createManualLead({ workspaceId: auth.workspaceId, userId: auth.user.id, input });
    await recordAudit({
      workspaceId: auth.workspaceId,
      actorUserId: auth.user.id,
      action: "create",
      entityType: "lead",
      entityId: lead.id,
      requestId: ctx.requestId,
      request,
    });
    return json({ lead }, 201);
  }

  const body = await readJson(request, bulkLeadActionSchema);

  let affected = 0;
  switch (body.action) {
    case "delete":
      affected = await deleteLeads(auth.workspaceId, body.leadIds);
      break;
    case "tag":
      if (!body.tag) throw new Error("A tag is required.");
      affected = await bulkTag(auth.workspaceId, body.leadIds, body.tag);
      break;
    case "untag":
      if (!body.tag) throw new Error("A tag is required.");
      affected = await bulkTag(auth.workspaceId, body.leadIds, body.tag, true);
      break;
    case "add_to_list":
      if (!body.listId) throw new Error("A list is required.");
      affected = await addLeadsToList(auth.workspaceId, body.listId, body.leadIds);
      break;
    case "remove_from_list":
      if (!body.listId) throw new Error("A list is required.");
      affected = await removeLeadsFromList(auth.workspaceId, body.listId, body.leadIds);
      break;
    case "mark_contacted":
      affected = await markContacted(auth.workspaceId, body.leadIds, true);
      break;
  }

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: body.action === "delete" ? "delete" : "update",
    entityType: "lead",
    requestId: ctx.requestId,
    request,
    metadata: { action: body.action, affected, tag: body.tag ?? null, listId: body.listId ?? null },
  });

  return json({ affected });
});

/** GET /api/leads?facets=1 — filter dropdown values. */
export const OPTIONS = withRoute("OPTIONS /api/leads", async (request, _ctx) => {
  const auth = await requireAuthContext();
  if (new URL(request.url).searchParams.get("facets") !== "1") {
    return json({});
  }
  const facets = await leadFacets(auth.workspaceId);
  return json(facets);
});
