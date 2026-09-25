import { describe, it, expect, vi } from "vitest";
import {
  diagnoseSupabaseAnonKey,
  diagnoseSupabaseServiceKey,
  diagnoseSupabaseUrl,
  jwtRole,
  looksLikeApiKey,
  normalizeEnvValue,
  supabaseProjectUrlFromApiKey,
  toAbsoluteUrl,
} from "@/lib/env-normalize";
import { parseServerEnv, reportEnvProblems } from "@/lib/env";

/**
 * Environment handling tests.
 *
 * The failure these guard against is mundane and expensive: a variable that
 * exists in a dashboard with an empty value, a value pasted with its quotes, a
 * hostname pasted without `https://`, or an API key pasted where the project URL
 * belongs. Each used to surface as `Invalid URL` from inside a dependency during
 * a production build, or as a deployment that booted and could not reach
 * anything.
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

describe("normalizeEnvValue", () => {
  it("treats a blank or whitespace-only value as unset", () => {
    expect(normalizeEnvValue("")).toBeUndefined();
    expect(normalizeEnvValue("   ")).toBeUndefined();
    expect(normalizeEnvValue("\n")).toBeUndefined();
    expect(normalizeEnvValue(undefined)).toBeUndefined();
  });

  it("strips whitespace and one layer of matching quotes", () => {
    expect(normalizeEnvValue('  "https://x.up.railway.app"  ')).toBe("https://x.up.railway.app");
    expect(normalizeEnvValue("'https://x.up.railway.app'")).toBe("https://x.up.railway.app");
    expect(normalizeEnvValue('"re_abc123"')).toBe("re_abc123");
  });

  it("leaves an unmatched quote alone rather than truncating a secret", () => {
    expect(normalizeEnvValue('re_abc"')).toBe('re_abc"');
    expect(normalizeEnvValue('"')).toBe('"');
  });
});

describe("toAbsoluteUrl", () => {
  it("assumes https for a bare host, as the dashboards display it", () => {
    expect(toAbsoluteUrl("zybble-production.up.railway.app")).toBe(
      "https://zybble-production.up.railway.app",
    );
    expect(toAbsoluteUrl(`${REF}.supabase.co`)).toBe(`https://${REF}.supabase.co`);
  });

  it("drops a trailing slash so path joins cannot double up", () => {
    expect(toAbsoluteUrl("https://worker.up.railway.app/")).toBe("https://worker.up.railway.app");
  });

  it("keeps localhost and explicit ports usable", () => {
    expect(toAbsoluteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects anything that is not a usable absolute URL", () => {
    expect(toAbsoluteUrl("not a url")).toBeNull();
    expect(toAbsoluteUrl("worker")).toBeNull();
    expect(toAbsoluteUrl("ftp://example.com")).toBeNull();
    // A JWT is a syntactically valid hostname, and using one as a base URL is
    // exactly the mistake this has to catch.
    expect(toAbsoluteUrl(ANON_KEY)).toBeNull();
  });
});

describe("credential recognition", () => {
  it("recognises JWTs and provider key prefixes, and only those", () => {
    expect(looksLikeApiKey(ANON_KEY)).toBe(true);
    expect(looksLikeApiKey("sb_secret_abc123")).toBe(true);
    expect(looksLikeApiKey("re_abc123")).toBe(true);
    expect(looksLikeApiKey("sk-abc123")).toBe(true);
    expect(looksLikeApiKey("zybble.up.railway.app")).toBe(false);
  });

  it("reads the role claim and the project ref", () => {
    expect(jwtRole(ANON_KEY)).toBe("anon");
    expect(jwtRole(SERVICE_KEY)).toBe("service_role");
    expect(jwtRole("sb_secret_abc")).toBeNull();
    expect(supabaseProjectUrlFromApiKey(ANON_KEY)).toBe(`https://${REF}.supabase.co`);
    expect(supabaseProjectUrlFromApiKey("sb_secret_abc")).toBeNull();
  });
});

describe("supabase diagnoses", () => {
  it("names the correct project URL when a key is pasted into the URL variable", () => {
    const problem = diagnoseSupabaseUrl(ANON_KEY);
    expect(problem).toContain("is an API key, not the project URL");
    expect(problem).toContain(`https://${REF}.supabase.co`);
  });

  it("accepts a bare host and a full URL, and reports anything else", () => {
    expect(diagnoseSupabaseUrl(`${REF}.supabase.co`)).toBeNull();
    expect(diagnoseSupabaseUrl(`https://${REF}.supabase.co`)).toBeNull();
    expect(diagnoseSupabaseUrl("worker")).toContain("is not a usable URL");
  });

  it("catches the anon key in the service-role slot", () => {
    expect(diagnoseSupabaseServiceKey(ANON_KEY)).toContain("service_role key");
    expect(diagnoseSupabaseServiceKey(SERVICE_KEY)).toBeNull();
    expect(diagnoseSupabaseServiceKey("sb_secret_abc123")).toBeNull();
    expect(diagnoseSupabaseServiceKey(`${REF}.supabase.co`)).toContain("is a URL, not a key");
  });

  it("catches the service-role key in the public anon slot", () => {
    expect(diagnoseSupabaseAnonKey(SERVICE_KEY)).toContain("inlined into the browser bundle");
    expect(diagnoseSupabaseAnonKey(ANON_KEY)).toBeNull();
  });
});

describe("parseServerEnv", () => {
  it("accepts a blank variable as unset instead of failing the build", () => {
    const { env, problems } = parseServerEnv({ WORKER_BASE_URL: "" });
    expect(problems).toEqual([]);
    expect(env.WORKER_BASE_URL).toBeUndefined();
  });

  it("normalises hosts, quotes and trailing slashes", () => {
    const { env, problems } = parseServerEnv({
      WORKER_BASE_URL: "zybble-worker.up.railway.app",
      NEXT_PUBLIC_SITE_URL: '"https://zybble.app/"',
    });
    expect(problems).toEqual([]);
    expect(env.WORKER_BASE_URL).toBe("https://zybble-worker.up.railway.app");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://zybble.app");
  });

  it("drops one unusable value and keeps every other one", () => {
    const { env, problems } = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      GEMINI_API_KEY: "AIza-not-a-real-key",
      EMAIL_FROM: "zybble <hello@example.com>",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("NEXT_PUBLIC_SUPABASE_URL is an API key");
    expect(problems[0]).toContain(`https://${REF}.supabase.co`);

    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(SERVICE_KEY);
    expect(env.GEMINI_API_KEY).toBe("AIza-not-a-real-key");
    expect(env.EMAIL_FROM).toBe("zybble <hello@example.com>");
  });

  it("applies schema defaults and never throws on a hostile environment", () => {
    const { env, problems } = parseServerEnv({
      WORKER_BASE_URL: "worker",
      NEXT_PUBLIC_SITE_URL: "not a url",
      SUPABASE_DB_URL: "postgres://user:pass@host:5432/db",
    });
    expect(problems).toHaveLength(2);
    expect(env.WORKER_BASE_URL).toBeUndefined();
    expect(env.EMAIL_FROM).toBe("zybble <no-reply@updates.zybble.app>");
    expect(env.GEMINI_MODEL).toBe("gemini-3.8-flash");
    expect(env.SUPABASE_DB_URL).toBe("postgres://user:pass@host:5432/db");
  });

  it("warns — without dropping the value — about a URL only Railway can resolve", () => {
    const { env, warnings } = parseServerEnv({
      WORKER_BASE_URL: "myzybble.railway.internal",
    });
    expect(env.WORKER_BASE_URL).toBe("https://myzybble.railway.internal");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(".railway.internal");
  });

  it("reads STRICT_ENV_VALIDATION case-insensitively", () => {
    expect(parseServerEnv({ STRICT_ENV_VALIDATION: "TRUE" }).env.STRICT_ENV_VALIDATION).toBe(true);
    expect(parseServerEnv({ STRICT_ENV_VALIDATION: "false" }).env.STRICT_ENV_VALIDATION).toBe(false);
    expect(parseServerEnv({}).env.STRICT_ENV_VALIDATION).toBe(false);
  });
});

describe("reportEnvProblems", () => {
  it("warns and carries on by default", () => {
    const log = vi.fn();
    expect(() => reportEnvProblems(["WORKER_BASE_URL is not a usable URL"], [], { log })).not.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain("WORKER_BASE_URL is not a usable URL");
  });

  it("throws when strict validation is on", () => {
    expect(() =>
      reportEnvProblems(["WORKER_BASE_URL is not a usable URL"], [], { strict: true, log: vi.fn() }),
    ).toThrow(/WORKER_BASE_URL is not a usable URL/);
  });

  it("stays silent when there is nothing to report", () => {
    const log = vi.fn();
    reportEnvProblems([], [], { log });
    expect(log).not.toHaveBeenCalled();
  });
});
