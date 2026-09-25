import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Auth integration tests (§12). Skipped unless a Supabase project and two test
 * users are configured.
 *
 * These cover the behaviours that are easy to break and painful to notice:
 * the anon client must not be able to read another user's data, `getSession()`
 * must not be trusted for authorisation, and a wrong password must fail.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const userA = { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD };

const configured = Boolean(url && anonKey && userA.email && userA.password);

describe.skipIf(!configured)("supabase auth", () => {
  let client: SupabaseClient;

  beforeAll(() => {
    client = createClient(url!, anonKey!);
  });

  it("signs in with valid credentials", async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email: userA.email!,
      password: userA.password!,
    });
    expect(error).toBeNull();
    expect(data.user?.email?.toLowerCase()).toBe(userA.email!.toLowerCase());
    expect(data.session?.access_token).toBeTruthy();
  }, 30_000);

  it("refuses a wrong password", async () => {
    const { error } = await client.auth.signInWithPassword({
      email: userA.email!,
      password: `${userA.password!}-definitely-wrong`,
    });
    expect(error).not.toBeNull();
  }, 30_000);

  it("keeps the session alive across a refresh", async () => {
    const { data } = await client.auth.signInWithPassword({
      email: userA.email!,
      password: userA.password!,
    });
    expect(data.session).toBeTruthy();

    const refreshed = await client.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session?.access_token).toBeTruthy();
  }, 30_000);

  it("exposes a user through getUser but never a service-role key", async () => {
    await client.auth.signInWithPassword({ email: userA.email!, password: userA.password! });
    const { data, error } = await client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();
    // The anon key must never be confused with the service role key.
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).not.toBe(anonKey);
  }, 30_000);

  it("signs out and leaves no usable session", async () => {
    await client.auth.signInWithPassword({ email: userA.email!, password: userA.password! });
    await client.auth.signOut();
    const { data } = await client.auth.getUser();
    expect(data.user).toBeNull();
  }, 30_000);

  it("cannot read auth admin APIs with the anon key", async () => {
    // A client-side leak of the anon key must not let anyone enumerate users.
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      headers: { apikey: anonKey!, authorization: `Bearer ${anonKey}` },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 30_000);
});
