import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static checks over the migration set.
 *
 * These catch the mistakes that are expensive to find at runtime: a migration
 * that forgets to enable RLS on a user-owned table, an out-of-order filename,
 * or an index that would be created without `if not exists` and therefore fail
 * on re-run.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Tables that hold user data and must therefore be RLS-protected. */
const USER_TABLES = [
  "profiles",
  "workspaces",
  "workspace_members",
  "subscriptions",
  "usage",
  "usage_events",
  "entitlements",
  "searches",
  "scrape_jobs",
  "scrape_job_events",
  "leads",
  "lead_emails",
  "lead_phones",
  "lead_tags",
  "lists",
  "list_members",
  "campaigns",
  "campaign_steps",
  "campaign_leads",
  "mailboxes",
  "suppression_entries",
  "automations",
  "automation_runs",
  "ai_conversations",
  "ai_messages",
  "notifications",
  "exports",
];

function allSql(): string {
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8")).join("\n");
}

/**
 * Migration 0011 enables RLS in a PL/pgSQL loop (DRY, one statement for 33
 * tables). Grep alone would report every table as unprotected, so we also
 * expand the loop's array and union the two sources.
 */
function rlsEnabledTables(): Set<string> {
  const found = new Set<string>();

  const direct = allSql().matchAll(
    /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s+(?:enable|force)\s+row\s+level\s+security/gi,
  );
  for (const m of direct) found.add(m[1].toLowerCase());

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    // `foreach t in array array[ 'a','b', ... ]`
    const loop = sql.match(/foreach\s+\w+\s+in\s+array\s+array\[([\s\S]*?)\]\s*\s*loop/i);
    if (loop?.[1]) {
      for (const name of loop[1].matchAll(/'([a-z0-9_]+)'/gi)) {
        found.add(name[1].toLowerCase());
      }
    }
  }

  return found;
}

describe("migration files", () => {
  it("has at least the core migrations", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it("uses zero-padded sequential prefixes so ordering is stable", () => {
    for (const file of files) {
      expect(file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    }
  });

  it("has no duplicate numbers", () => {
    const numbers = files.map((f) => f.slice(0, 4));
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("row level security", () => {
  it("enables RLS on every user-owned table", () => {
    const enabled = rlsEnabledTables();
    for (const table of USER_TABLES) {
      expect(enabled, `RLS must be enabled on public.${table}`).toContain(table);
    }
  });

  it("also enables RLS on the platform tables", () => {
    const enabled = rlsEnabledTables();
    for (const table of ["plans", "billing_events", "email_events", "audit_logs"]) {
      expect(enabled, `RLS must be enabled on public.${table}`).toContain(table);
    }
  });

  it("has at least one policy per user-owned table", () => {
    const sql = allSql();
    for (const table of USER_TABLES) {
      const matcher = new RegExp(`policy\\s+[a-z0-9_]+\\s+on\\s+(public\\.)?${table}\\s`, "i");
      expect(sql, `at least one RLS policy is needed on public.${table}`).toMatch(matcher);
    }
  });
});

describe("idempotency guards", () => {
  it("creates tables with `if not exists`", () => {
    const sql = allSql();
    const creates = sql.match(/create\s+table\s+(?!if not exists)/gi) ?? [];
    expect(creates).toEqual([]);
  });

  it("creates indexes with `if not exists`", () => {
    const sql = allSql();
    const creates = sql.match(/create\s+(unique\s+)?index\s+(?!if not exists)/gi) ?? [];
    expect(creates).toEqual([]);
  });

  it("drops policies before creating them, so a re-run is safe", () => {
    const sql = allSql();
    const policyCreates = (sql.match(/create\s+policy\s+([a-z0-9_]+)/gi) ?? []).map((m) =>
      m.replace(/create\s+policy\s+/i, "").toLowerCase(),
    );
    const policyDrops = (sql.match(/drop\s+policy\s+if\s+exists\s+([a-z0-9_]+)/gi) ?? []).map((m) =>
      m.replace(/drop\s+policy\s+if\s+exists\s+/i, "").toLowerCase(),
    );
    for (const name of policyCreates) {
      expect(policyDrops, `policy "${name}" must be dropped before create`).toContain(name);
    }
  });
});

describe("queue safety", () => {
  it("prevents more than one active scrape job per workspace", () => {
    // The quota-bypass guard from §10: a user must not be able to run many
    // parallel jobs to exceed their monthly lead allowance.
    expect(allSql()).toMatch(/scrape_jobs_one_active_per_workspace/);
  });

  it("enforces idempotency on usage events and campaign recipients", () => {
    const sql = allSql();
    expect(sql).toMatch(/usage_events[\s\S]{0,400}unique/i);
    expect(sql).toMatch(/campaign_leads_idem_unique|idempotency_key\s+text\s+not\s+null/i);
  });
});

describe("secret handling", () => {
  it("never stores an SMTP password in plain text", () => {
    const sql = allSql();
    expect(sql).toMatch(/smtp_password_encrypted/);
    expect(sql).not.toMatch(/smtp_password\s+text[^_]/i);
  });

  it("hashes one-time tokens at rest", () => {
    const sql = allSql();
    expect(sql).toMatch(/token_hash/);
    expect(sql).toMatch(/digest\(/i);
  });
});
