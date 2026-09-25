import "server-only";
import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/errors";
import type { ListRow } from "@/types/database";

/** Lists service (§17). Membership is unique by (list_id, lead_id) in the DB. */

export async function listLists(workspaceId: string): Promise<
  (ListRow & { member_count: number })[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .select("*, list_members(count)")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw Errors.internal("Could not load your lists.");

  return ((data ?? []) as unknown as (ListRow & { list_members: { count: number }[] })[]).map(
    ({ list_members, ...list }) => ({
      ...list,
      member_count: list_members?.[0]?.count ?? 0,
    }),
  );
}

export async function getList(workspaceId: string, listId: string): Promise<ListRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lists")
    .select("*")
    .eq("id", listId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as ListRow | null) ?? null;
}

export async function createList(
  workspaceId: string,
  userId: string,
  input: { name: string; description?: string | null; color?: string | null },
): Promise<ListRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "lime",
    } as never)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw Errors.conflict("A list with that name already exists.");
    throw Errors.internal("Could not create that list.");
  }
  return data as ListRow;
}

export async function updateList(
  workspaceId: string,
  listId: string,
  patch: { name?: string; description?: string | null; color?: string | null; archived?: boolean },
): Promise<ListRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.archived !== undefined
        ? { archived_at: patch.archived ? new Date().toISOString() : null }
        : {}),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", listId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error || !data) throw Errors.internal("Could not update that list.");
  return data as ListRow;
}

export async function deleteList(workspaceId: string, listId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lists")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", listId)
    .eq("workspace_id", workspaceId);
  if (error) throw Errors.internal("Could not delete that list.");
}

/**
 * Adds leads to a list. Duplicate membership is impossible: the composite
 * primary key on (list_id, lead_id) makes this idempotent (§17).
 */
export async function addLeadsToList(workspaceId: string, listId: string, leadIds: string[]): Promise<number> {
  const supabase = await createClient();

  const { data: owned } = await supabase
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!owned) throw Errors.notFound("That list doesn't exist.");

  const rows = [...new Set(leadIds)].map((lead_id) => ({ list_id: listId, lead_id }));
  const { data, error } = await supabase
    .from("list_members")
    .upsert(rows as never, { onConflict: "list_id,lead_id", ignoreDuplicates: true })
    .select("lead_id");

  if (error) throw Errors.internal("Could not add those leads.");
  return (data ?? []).length;
}

export async function removeLeadsFromList(workspaceId: string, listId: string, leadIds: string[]): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .in("lead_id", leadIds)
    .select("lead_id");
  if (error) throw Errors.internal("Could not remove those leads.");
  return (data ?? []).length;
}

export async function listListLeadIds(workspaceId: string, listId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("list_members")
    .select("lead_id")
    .eq("list_id", listId)
    .limit(200_000);
  return ((data ?? []) as { lead_id: string }[]).map((r) => r.lead_id);
}
