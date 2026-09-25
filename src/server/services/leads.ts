import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { LeadFilters } from "@/lib/validation";
import type { LeadRow, LeadEmailRow, LeadPhoneRow } from "@/types/database";
import { dedupeKeyForManual } from "@/server/services/searches";
import { buildDedupeKey, fallbackDedupeKey } from "@/lib/normalization/dedupe";
import { normalizePhone } from "@/lib/normalization/phone";
import { assessEmail } from "@/lib/normalization/email";
import { canonicalDomain } from "@/lib/normalization/domain";

/**
 * Lead service (§16, §36, §37).
 *
 * All filtering, sorting and pagination happen in Postgres. The browser never
 * receives (and never filters) more than one page of leads, so the UI stays
 * responsive with hundreds of thousands of rows.
 */

/** Columns the list view actually renders — never `SELECT *` (§36). */
const LIST_COLUMNS =
  "id, workspace_id, source, business_name, category, website, maps_url, city, state, country, " +
  "primary_email, primary_phone, email_status, rating, review_count, business_status, lead_score, " +
  "logo_url, is_dev_data, times_seen, contacted_at, created_at, updated_at";

export interface LeadListPage {
  leads: LeadRow[];
  nextCursor: string | null;
  total: number | null;
}

export interface LeadListOptions extends Partial<LeadFilters> {
  cursor?: string;
  limit?: number;
}

/** Builds a keyset cursor from the sort column + id. */
function encodeCursor(row: LeadRow, sort: NonNullable<LeadFilters["sort"]>): string {
  const raw = `${sortValue(row, sort)}|${row.id}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { value: string; id: string } | null {
  try {
    const [value, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!value || !id) return null;
    return { value, id };
  } catch {
    return null;
  }
}

function sortValue(row: LeadRow, sort: NonNullable<LeadFilters["sort"]>): string {
  switch (sort) {
    case "name":
      return row.business_name.toLowerCase();
    case "rating":
      return String(row.rating ?? "");
    case "reviews":
      return String(row.review_count ?? "");
    case "score":
      return String(row.lead_score);
    case "city":
      return (row.city ?? "").toLowerCase();
    default:
      return row.created_at;
  }
}

export async function listLeads(
  workspaceId: string,
  options: LeadListOptions,
): Promise<LeadListPage> {
  const supabase = await createClient();
  const {
    q, city, state, country, category, emailStatus,
    hasEmail, hasPhone, hasWebsite, minRating, minReviewCount, minScore,
    tags, listId, searchId, source, contacted,
    sort = "recent", direction = "desc",
    cursor, limit = 50,
  } = options;

  let query = supabase
    .from("leads")
    .select(LIST_COLUMNS, { count: "estimated" })
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (q) {
    // Uses the generated tsvector for name/category/city/address.
    query = query.textSearch("search_vector", q.split(/\s+/).filter(Boolean).join(" & "), {
      type: "websearch",
      config: "simple",
    });
  }
  if (city) query = query.ilike("city", city);
  if (state) query = query.ilike("state", state);
  if (country) query = query.ilike("country", country);
  if (category) query = query.ilike("category", category);
  if (emailStatus) query = query.eq("email_status", emailStatus);
  if (hasEmail === true) query = query.not("primary_email", "is", null);
  if (hasEmail === false) query = query.is("primary_email", null);
  if (hasPhone === true) query = query.not("primary_phone", "is", null);
  if (hasPhone === false) query = query.is("primary_phone", null);
  if (hasWebsite === true) query = query.not("website", "is", null);
  if (hasWebsite === false) query = query.is("website", null);
  if (typeof minRating === "number") query = query.gte("rating", minRating);
  if (typeof minReviewCount === "number") query = query.gte("review_count", minReviewCount);
  if (typeof minScore === "number") query = query.gte("lead_score", minScore);
  if (source) query = query.eq("source", source);
  if (contacted === true) query = query.not("contacted_at", "is", null);
  if (contacted === false) query = query.is("contacted_at", null);
  if (searchId) query = query.eq("search_id", searchId);

  if (listId) {
    const { data: memberIds } = await supabase
      .from("list_members")
      .select("lead_id")
      .eq("list_id", listId)
      .limit(50_000);
    const ids = (memberIds ?? []).map((m) => m.lead_id);
    if (ids.length === 0) return { leads: [], nextCursor: null, total: 0 };
    query = query.in("id", ids);
  }

  if (tags?.length) {
    const { data: taggedLeads } = await supabase
      .from("lead_tags")
      .select("lead_id")
      .in("tag", tags)
      .limit(50_000);
    const ids = [...new Set((taggedLeads ?? []).map((t) => t.lead_id))];
    if (ids.length === 0) return { leads: [], nextCursor: null, total: 0 };
    query = query.in("id", ids);
  }

  // Keyset pagination: stable and index-backed at any dataset size (§37).
  const ascending = direction === "asc";
  const sortColumn = {
    recent: "created_at",
    name: "business_name",
    rating: "rating",
    reviews: "review_count",
    score: "lead_score",
    city: "city",
  }[sort];

  query = query.order(sortColumn, { ascending, nullsFirst: false });
  query = query.order("id", { ascending });

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      // PostgREST keyset: (sortCol, id) > (cursorValue, cursorId) for ascending.
      if (ascending) {
        query = query.or(
          `${sortColumn}.gt.${decoded.value},and(${sortColumn}.eq.${decoded.value},id.gt.${decoded.id})`,
        );
      } else {
        query = query.or(
          `${sortColumn}.lt.${decoded.value},and(${sortColumn}.eq.${decoded.value},id.lt.${decoded.id})`,
        );
      }
    }
  }

  const { data, count, error } = await query.limit(Math.min(limit, 200));

  if (error) {
    logger.error("leads.list_failed", {
      workspace_id: workspaceId,
      event: "leads.list",
      status: "error",
      error_code: error.code,
    });
    throw Errors.internal("Could not load leads.");
  }

  const leads = (data as unknown as LeadRow[] | null) ?? [];
  const nextCursor =
    leads.length === limit ? encodeCursor(leads[leads.length - 1], sort) : null;

  return { leads, nextCursor, total: count ?? null };
}

export async function getLead(workspaceId: string, leadId: string): Promise<LeadRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as LeadRow | null) ?? null;
}

export async function getLeadContacts(workspaceId: string, leadId: string) {
  const supabase = await createClient();
  const [emails, phones, tags] = await Promise.all([
    supabase.from("lead_emails").select("*").eq("lead_id", leadId).order("created_at"),
    supabase.from("lead_phones").select("*").eq("lead_id", leadId).order("created_at"),
    supabase.from("lead_tags").select("tag").eq("lead_id", leadId).order("tag"),
  ]);
  return {
    emails: (emails.data as LeadEmailRow[] | null) ?? [],
    phones: (phones.data as LeadPhoneRow[] | null) ?? [],
    tags: ((tags.data ?? []) as { tag: string }[]).map((t) => t.tag),
  };
}

export async function getLeadLists(workspaceId: string, leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("list_members")
    .select("list:lists(id, name, color)")
    .eq("lead_id", leadId);
  return ((data ?? []) as unknown as { list: { id: string; name: string; color: string | null } | null }[])
    .map((row) => row.list)
    .filter((l): l is { id: string; name: string; color: string | null } => Boolean(l));
}

export async function updateLead(
  workspaceId: string,
  leadId: string,
  patch: Record<string, unknown>,
): Promise<LeadRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .maybeSingle();

  if (error || !data) throw Errors.internal("Could not update that lead.");
  return data as LeadRow;
}

export async function deleteLeads(workspaceId: string, leadIds: string[]): Promise<number> {
  const supabase = await createClient();
  // Soft delete keeps exports and campaign history referentially intact (§34).
  const { data, error } = await supabase
    .from("leads")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("workspace_id", workspaceId)
    .in("id", leadIds)
    .is("deleted_at", null)
    .select("id");

  if (error) throw Errors.internal("Could not delete those leads.");
  return (data ?? []).length;
}

export async function bulkTag(workspaceId: string, leadIds: string[], tag: string, remove = false): Promise<number> {
  const supabase = await createClient();

  if (remove) {
    const { data } = await supabase
      .from("lead_tags")
      .delete()
      .eq("tag", tag)
      .in("lead_id", leadIds)
      .select("lead_id");
    return (data ?? []).length;
  }

  const rows = [...new Set(leadIds)].map((lead_id) => ({ lead_id, tag }));
  const { data, error } = await supabase
    .from("lead_tags")
    .upsert(rows as never, { onConflict: "lead_id,tag", ignoreDuplicates: true })
    .select("lead_id");

  if (error) throw Errors.internal("Could not tag those leads.");
  return (data ?? []).length;
}

export async function markContacted(workspaceId: string, leadIds: string[], contacted: boolean): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({
      contacted_at: contacted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("workspace_id", workspaceId)
    .in("id", leadIds)
    .select("id");
  if (error) throw Errors.internal("Could not update those leads.");
  return (data ?? []).length;
}

export async function createManualLead(params: {
  workspaceId: string;
  userId: string;
  input: {
    businessName: string;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    category?: string | null;
    notes?: string | null;
  };
}): Promise<LeadRow> {
  const supabase = await createClient();
  const { workspaceId, input } = params;

  const dedupeKey = dedupeKeyForManual({
    businessName: input.businessName,
    website: input.website ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
  });

  const phone = input.phone ? normalizePhone(input.phone) : null;
  const email = input.email ? assessEmail(input.email) : null;
  if (input.email && (!email || email.verdict === "invalid")) {
    throw Errors.validation("That email address doesn't look valid.", { email: "Invalid address." });
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      workspace_id: workspaceId,
      source: "manual",
      business_name: input.businessName,
      website: input.website ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      category: input.category ?? null,
      notes: input.notes ?? null,
      primary_email: email?.email ?? null,
      primary_phone: phone?.e164 ?? null,
      email_status: email ? "unknown" : "unknown",
      dedupe_key: dedupeKey,
      lead_score: 0,
    } as never)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw Errors.conflict("A lead with the same identity already exists in this workspace.");
    }
    throw Errors.internal("Could not create that lead.");
  }

  const lead = data as LeadRow;

  if (email) {
    await supabase.from("lead_emails").insert({
      lead_id: lead.id,
      workspace_id: workspaceId,
      email: email.email as never,
      status: "unknown",
      is_primary: true,
      source: "manual",
      confidence: 0.5,
      reason: email.reason,
    } as never);
  }
  if (phone) {
    await supabase.from("lead_phones").insert({
      lead_id: lead.id,
      workspace_id: workspaceId,
      e164: phone.e164,
      raw: phone.raw,
      kind: phone.kind,
      is_primary: true,
    } as never);
  }

  return lead;
}

/** Aggregates used by the dashboard (§25) — computed in SQL, never faked. */
export async function workspaceStats(workspaceId: string) {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    totalLeads,
    monthLeads,
    verifiedEmails,
    withPhone,
    withWebsite,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "estimated", head: true })
      .eq("workspace_id", workspaceId).is("deleted_at", null),
    supabase.from("leads").select("id", { count: "estimated", head: true })
      .eq("workspace_id", workspaceId).is("deleted_at", null)
      .gte("created_at", monthStart.toISOString()),
    supabase.from("leads").select("id", { count: "estimated", head: true })
      .eq("workspace_id", workspaceId).is("deleted_at", null).eq("email_status", "valid"),
    supabase.from("leads").select("id", { count: "estimated", head: true })
      .eq("workspace_id", workspaceId).is("deleted_at", null).not("primary_phone", "is", null),
    supabase.from("leads").select("id", { count: "estimated", head: true })
      .eq("workspace_id", workspaceId).is("deleted_at", null).not("website", "is", null),
  ]);

  return {
    totalLeads: totalLeads.count ?? 0,
    leadsThisMonth: monthLeads.count ?? 0,
    verifiedEmails: verifiedEmails.count ?? 0,
    withPhone: withPhone.count ?? 0,
    withWebsite: withWebsite.count ?? 0,
  };
}

/** Distinct facet values for filter dropdowns. */
export async function leadFacets(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("city, category")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .limit(5_000);

  const cities = new Set<string>();
  const categories = new Set<string>();
  for (const row of (data ?? []) as { city: string | null; category: string | null }[]) {
    if (row.city) cities.add(row.city);
    if (row.category) categories.add(row.category);
  }
  return {
    cities: [...cities].sort().slice(0, 300),
    categories: [...categories].sort().slice(0, 300),
  };
}

export { buildDedupeKey, fallbackDedupeKey, canonicalDomain };
