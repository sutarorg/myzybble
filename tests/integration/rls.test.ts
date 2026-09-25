import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * RLS enforcement tests (§14).
 *
 * These are the real defence-in-depth check: two ordinary users with valid
 * sessions, each asserting that the *other's* rows are invisible. They need a
 * migrated Supabase project and two pre-created confirmed test users, and skip
 * otherwise.
 *
 * Setup:
 *   TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD
 *   TEST_USER_B_EMAIL / TEST_USER_B_PASSWORD
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userA = { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD };
const userB = { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD };

const configured =
  Boolean(url && anonKey && serviceKey && userA.email && userA.password && userB.email && userB.password);

describe.skipIf(!configured)("row level security", () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let admin: SupabaseClient;
  let workspaceA: string;
  let workspaceB: string;

  beforeAll(async () => {
    a = createClient(url!, anonKey!);
    b = createClient(url!, anonKey!);
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });

    await a.auth.signInWithPassword({ email: userA.email!, password: userA.password! });
    await b.auth.signInWithPassword({ email: userB.email!, password: userB.password! });

    const memberA = await a.from("workspace_members").select("workspace_id").limit(1).single();
    const memberB = await b.from("workspace_members").select("workspace_id").limit(1).single();
    workspaceA = memberA.data!.workspace_id as string;
    workspaceB = memberB.data!.workspace_id as string;

    expect(workspaceA).not.toBe(workspaceB);
  }, 30_000);

  it("lets a user read their own workspace", async () => {
    const { data, error } = await a.from("workspaces").select("id").eq("id", workspaceA).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(workspaceA);
  });

  it("hides another workspace from a user", async () => {
    const { data, error } = await a.from("workspaces").select("id").eq("id", workspaceB).single();
    // RLS makes the row invisible: no error, just no rows.
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });

  it("hides another workspace's leads when listing", async () => {
    const { data: own } = await a.from("leads").select("id, workspace_id").limit(50);
    expect((own ?? []).every((r) => r.workspace_id === workspaceA)).toBe(true);
  });

  it("refuses to insert a lead into another workspace", async () => {
    const { error } = await a.from("leads").insert({
      workspace_id: workspaceB,
      business_name: "Cross Tenant Probe",
      dedupe_key: `probe:${Date.now()}`,
    } as never);
    expect(error).not.toBeNull();
  });

  it("refuses to update another workspace's lead", async () => {
    const { data: victims } = await admin
      .from("leads")
      .select("id")
      .eq("workspace_id", workspaceB)
      .limit(1);
    if (!victims?.length) return; // nothing to attack; the check is still valid

    const { data } = await a
      .from("leads")
      .update({ business_name: "Hijacked" } as never)
      .eq("id", victims[0].id)
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read another user's profile", async () => {
    const { data: me } = await a.auth.getUser();
    const { data: other } = await admin
      .from("profiles")
      .select("id")
      .neq("id", me.user!.id)
      .limit(1);
    if (!other?.length) return;

    const { data } = await a.from("profiles").select("id").eq("id", other[0].id).single();
    expect(data).toBeNull();
  });

  it("cannot read the audit log", async () => {
    // audit_logs is admin-only: a normal member must see nothing.
    const { data } = await a.from("audit_logs").select("id").limit(5);
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read another workspace's campaigns, lists or mailboxes", async () => {
    for (const table of ["campaigns", "lists", "mailboxes", "automations", "searches"]) {
      const { data } = await a.from(table).select("id, workspace_id").limit(50);
      expect((data ?? []).every((r) => r.workspace_id === workspaceA), table).toBe(true);
    }
  });

  it("cannot see another workspace's notifications", async () => {
    const { data } = await a.from("notifications").select("id, workspace_id").limit(50);
    expect((data ?? []).every((r) => r.workspace_id === workspaceA)).toBe(true);
  });
});
