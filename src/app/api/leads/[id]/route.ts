import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { getLead, getLeadContacts, getLeadLists, updateLead, deleteLeads } from "@/server/services/leads";
import { recordAudit } from "@/server/services/audit";
import { leadUpdateSchema } from "@/lib/validation";

/** GET /api/leads/[id] — full lead with contacts, tags and lists. */
export const GET = withRoute("GET /api/leads/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const id = ctx.params.id;

  const lead = await getLead(auth.workspaceId, id);
  if (!lead) return json({ error: { code: "not_found", message: "Lead not found." } }, 404);

  const [contacts, lists] = await Promise.all([
    getLeadContacts(auth.workspaceId, id),
    getLeadLists(auth.workspaceId, id),
  ]);

  return json({ lead, ...contacts, lists });
});

/** PATCH /api/leads/[id] — update stored fields. */
export const PATCH = withRoute("PATCH /api/leads/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("leads:search", auth.user.id, ctx);
  const id = ctx.params.id;

  const input = await readJson(request, leadUpdateSchema);

  const patch: Record<string, unknown> = {};
  if (input.businessName !== undefined) patch.business_name = input.businessName;
  if (input.website !== undefined) patch.website = input.website || null;
  if (input.address !== undefined) patch.address = input.address || null;
  if (input.city !== undefined) patch.city = input.city || null;
  if (input.state !== undefined) patch.state = input.state || null;
  if (input.country !== undefined) patch.country = input.country || null;
  if (input.postalCode !== undefined) patch.postal_code = input.postalCode || null;
  if (input.category !== undefined) patch.category = input.category || null;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (input.rating !== undefined) patch.rating = input.rating ?? null;
  if (input.reviewCount !== undefined) patch.review_count = input.reviewCount ?? null;
  if (input.contacted === true) patch.contacted_at = new Date().toISOString();
  if (input.contacted === false) patch.contacted_at = null;

  if (input.phone !== undefined) patch.primary_phone = input.phone || null;
  if (input.email !== undefined) patch.primary_email = input.email || null;

  const lead = await updateLead(auth.workspaceId, id, patch);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "update",
    entityType: "lead",
    entityId: id,
    requestId: ctx.requestId,
    request,
    changes: { fields: Object.keys(patch) },
  });

  return json({ lead });
});

/** DELETE /api/leads/[id] — soft delete. */
export const DELETE = withRoute("DELETE /api/leads/[id]", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  const id = ctx.params.id;

  const affected = await deleteLeads(auth.workspaceId, [id]);
  if (affected === 0) return json({ error: { code: "not_found", message: "Lead not found." } }, 404);

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "delete",
    entityType: "lead",
    entityId: id,
    requestId: ctx.requestId,
    request,
  });

  return json({ ok: true });
});
