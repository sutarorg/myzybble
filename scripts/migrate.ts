/**
 * Migration runner: applies `supabase/migrations/*.sql` in filename order.
 *
 * Design notes:
 *  - Progress is tracked in a `schema_migrations` table, so the runner is
 *    idempotent — run it as many times as you like (`npm run db:migrate`).
 *  - Each file runs inside a single transaction. A migration is all-or-nothing;
 *    a half-applied migration is impossible by construction.
 *  - The SQL files are *also* written to be re-runnable (`if not exists` /
 *    `create or replace` / `exception when duplicate_object`), so they stay
 *    usable with `supabase db push` and fresh sandbox databases where the
 *    tracking table doesn't exist yet.
 *  - The connection string comes from `SUPABASE_DB_URL` (the session pooler
 *    URL from Project settings → Database) or `DATABASE_URL`. This is the
 *    direct Postgres connection — **not** the service-role key — because DDL
 *    runs as `postgres`, not as a Supabase role.
 *
 * Usage:
 *   npm run db:migrate                 # apply pending migrations
 *   npm run db:migrate -- --status     # show what is applied, apply nothing
 *
 * The `postgres` package is used directly instead of the Supabase client for
 * the same reason: migrations are DDL, and DDL needs a plain Postgres session.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function connectionString(): string {
  const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Missing SUPABASE_DB_URL (or DATABASE_URL).\n" +
        "Copy the connection string from Supabase → Project settings → Database\n" +
        "(the session pooler URI, port 5432) and put it in .env.local.",
    );
    process.exit(1);
  }
  return url;
}

interface AppliedRow {
  name: string;
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes("--status");

  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const sql = postgres(connectionString(), {
    // Migrations are one session at a time; keep it simple and observable.
    max: 1,
    onnotice: () => {},
  });

  try {
    await sql`create table if not exists public.schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )`;

    const applied = new Set(
      ((await sql`select name from public.schema_migrations`) as AppliedRow[]).map((r) => r.name),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    const pending = files.filter((f) => !applied.has(f));

    if (statusOnly) {
      for (const f of files) console.log(`${applied.has(f) ? "applied " : "pending"}  ${f}`);
      console.log(`\n${applied.size}/${files.length} applied, ${pending.length} pending.`);
      return;
    }

    if (pending.length === 0) {
      console.log(`schema_migrations: already up to date (${files.length} migrations).`);
      return;
    }

    for (const file of pending) {
      const path = join(MIGRATIONS_DIR, file);
      const contents = readFileSync(path, "utf8");
      const started = Date.now();
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`insert into public.schema_migrations (name) values (${file})`;
      });
      console.log(`applied  ${file}  (${Date.now() - started}ms)`);
    }

    console.log(`\nDone: ${pending.length} migration(s) applied.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
