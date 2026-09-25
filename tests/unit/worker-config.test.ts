import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Worker (Railway) configuration tests.
 *
 * The worker reads the same two Supabase variables the web app does, out of a
 * different dashboard. These guard the two mistakes that are otherwise nearly
 * invisible: an API key pasted into the project-URL slot (fails deep inside the
 * Supabase client as `Invalid URL`) and the anon key pasted into the service-role
 * slot (boots, then reads nothing because RLS filters it).
 */

/** A structurally valid JWT with the given payload (no real keys here). */
function token(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.c2lnbmF0dXJl`;
}

const REF = "nrdhcxarlfnkslfbhcal";
const ANON_KEY = token({ iss: "supabase", ref: REF, role: "anon" });
const SERVICE_KEY = token({ iss: "supabase", ref: REF, role: "service_role" });

async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("../../scraper/src/config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("worker assertConfigured", () => {
  it("accepts a bare host and the service-role key", async () => {
    const { config, assertConfigured } = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: `"${REF}.supabase.co"`,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(() => assertConfigured()).not.toThrow();
    expect(config.supabaseUrl).toBe(`https://${REF}.supabase.co`);
  });

  it("says which URL the pasted API key belongs to", async () => {
    const { assertConfigured } = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(() => assertConfigured()).toThrow(/NEXT_PUBLIC_SUPABASE_URL is an API key/);
    expect(() => assertConfigured()).toThrow(new RegExp(`https://${REF}\\.supabase\\.co`));
  });

  it("catches the anon key in the service-role slot", async () => {
    const { assertConfigured } = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: ANON_KEY,
    });

    expect(() => assertConfigured()).toThrow(/SUPABASE_SERVICE_ROLE_KEY is a "anon" key/);
  });

  it("names a missing variable", async () => {
    const { assertConfigured } = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });

    expect(() => assertConfigured()).toThrow(/Missing required environment variable NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("worker tuning values", () => {
  it("treats a blank or non-numeric knob as unset rather than as zero", async () => {
    const { config } = await loadConfig({
      PORT: "",
      WORKER_POLL_INTERVAL_MS: "not-a-number",
      WORKER_HEARTBEAT_INTERVAL_MS: "  25000  ",
      SCRAPER_DEPTH: "2",
    });

    // A zeroed PORT would bind nowhere and a zeroed poll interval would hot-loop.
    expect(config.port).toBe(8080);
    expect(config.pollIntervalMs).toBe(3_000);
    expect(config.heartbeatIntervalMs).toBe(25_000);
    expect(config.scrapeDepth).toBe(2);
  });

  it("ignores WORKER_DEV_MODE in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { config } = await loadConfig({ WORKER_DEV_MODE: "true" });
    expect(config.devMode).toBe(false);
  });
});
