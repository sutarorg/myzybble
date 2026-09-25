import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";

/**
 * Route-level contract tests for `/api/webhooks/resend`.
 *
 * A fake Supabase admin client stands in for the database, so these run
 * offline. What they actually assert are the security properties that are easy
 * to get wrong and expensive to get wrong:
 *
 *  - an invalid signature is **recorded but never applied** (no suppression is
 *    written, no recipient state changes);
 *  - a replayed delivery is acknowledged as a duplicate and applied once;
 *  - a bounce writes a **workspace-wide** suppression entry;
 *  - a complaint writes one too, and is treated as terminal.
 *
 * The signature is computed here with node:crypto against the documented Svix
 * construction, never by calling the module under test.
 */

const SECRET = `whsec_${randomBytes(24).toString("base64")}`;
const KEY = Buffer.from(SECRET.slice("whsec_".length), "base64");

interface StoredRow {
  id: string;
  [key: string]: unknown;
}

interface MockState {
  emailEvents: StoredRow[];
  updates: { table: string; values: Record<string, unknown>; filters: Record<string, unknown> }[];
  suppressions: { workspace_id: string; email: string; reason: string; source: string }[];
  recipient: { id: string; workspace_id: string; campaign_id: string; opened_at?: string | null } | null;
  emailEventSelectResult: unknown;
}

function createState(): MockState {
  return {
    emailEvents: [],
    updates: [],
    suppressions: [],
    recipient: null,
    emailEventSelectResult: undefined,
  };
}

function makeAdmin(state: MockState) {
  let counter = 0;

  function resolve(builder: any): { data: unknown; error: null } {
    const table = builder._table as string;
    const op = builder._op as string | null;
    const filters = builder._filters as Record<string, unknown>;
    const mode = builder._mode as string | undefined;

    if (table === "email_events") {
      if (op === "insert") {
        const row = { id: `ee_${++counter}`, ...(builder._rows as object) };
        state.emailEvents.push(row);
        return { data: row, error: null };
      }
      if (op === "update") {
        state.updates.push({ table, values: builder._values ?? {}, filters });
        const row = state.emailEvents.find((r) => r.id === filters.id);
        return { data: row ?? null, error: null };
      }
      // select: dedupe lookup on (provider, provider_event_id)
      if (state.emailEventSelectResult !== undefined) {
        return { data: state.emailEventSelectResult, error: null };
      }
      const found = state.emailEvents.find(
        (r) => r.provider === filters.provider && r.provider_event_id === filters.provider_event_id,
      );
      return { data: found ?? null, error: null };
    }

    if (table === "campaign_leads") {
      if (op === "update") {
        state.updates.push({ table, values: builder._values ?? {}, filters });
        return { data: null, error: null };
      }
      const recipient = state.recipient;
      if (!recipient) return { data: null, error: null };
      // The opened_at lookup asks for that column specifically.
      if (mode === "maybeSingle" && builder._columns === "opened_at") {
        return { data: { opened_at: recipient.opened_at ?? null }, error: null };
      }
      return { data: recipient, error: null };
    }

    if (table === "campaigns") {
      if (op === "update") {
        state.updates.push({ table, values: builder._values ?? {}, filters });
        return { data: null, error: null };
      }
      return { data: { stats: { sent: 1, delivered: 0, opened: 0, bounced: 0, failed: 0, skipped: 0 } }, error: null };
    }

    if (table === "suppression_entries") {
      if (op === "upsert") {
        state.suppressions.push(builder._values as never);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }

    if (table === "notifications") {
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  function builder(table: string) {
    const b: any = {
      _table: table,
      _op: null,
      _filters: {} as Record<string, unknown>,
      _mode: undefined as string | undefined,
      _columns: undefined as string | undefined,
    };
    b.select = (columns?: string) => {
      b._columns = columns;
      return b;
    };
    b.insert = (rows: unknown) => {
      b._op = "insert";
      b._rows = rows;
      return b;
    };
    b.update = (values: unknown) => {
      b._op = "update";
      b._values = values;
      return b;
    };
    b.upsert = (values: unknown) => {
      b._op = "upsert";
      b._values = values;
      return b;
    };
    b.delete = () => {
      b._op = "delete";
      return b;
    };
    b.eq = (col: string, val: unknown) => {
      b._filters[col] = val;
      return b;
    };
    b.in = (col: string, val: unknown) => {
      b._filters[col] = val;
      return b;
    };
    b.is = (col: string, val: unknown) => {
      b._filters[col] = val;
      return b;
    };
    b.order = () => b;
    b.limit = () => b;
    b.single = () => {
      b._mode = "single";
      return Promise.resolve(resolve(b));
    };
    b.maybeSingle = () => {
      b._mode = "maybeSingle";
      return Promise.resolve(resolve(b));
    };
    b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolve(b)).then(onFulfilled, onRejected);
    return b;
  }

  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve({ data: [{ allowed: true, remaining: 99 }], error: null }),
  };
}

let POST: (request: NextRequest) => Promise<Response>;
let state: MockState;

function signatureFor(id: string, timestamp: string, payload: string): string {
  return createHmac("sha256", KEY).update(`${id}.${timestamp}.${payload}`, "utf8").digest("base64");
}

function buildRequest(payload: string, options: { id?: string; timestamp?: string; sign?: boolean; secret?: Buffer } = {}) {
  const id = options.id ?? "msg_test";
  const ts = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const key = options.secret ?? KEY;
  const digest =
    options.sign === false
      ? "v1,deadbeefdeadbeefdeadbeef"
      : `v1,${createHmac("sha256", key).update(`${id}.${ts}.${payload}`, "utf8").digest("base64")}`;

  return new NextRequest("https://app.example.com/api/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": digest,
    },
    body: payload,
  });
}

function deliveredEvent(email = "lead@example.com") {
  return JSON.stringify({
    type: "email.delivered",
    created_at: new Date().toISOString(),
    data: {
      email_id: "em_1",
      message_id: "msg_1",
      from: "zybble <no-reply@updates.zybble.app>",
      to: [email],
      subject: "Hello",
      tags: { campaign_id: "camp_1", workspace_id: "ws_1" },
    },
  });
}

function bouncedEvent(email = "lead@example.com") {
  return JSON.stringify({
    type: "email.bounced",
    created_at: new Date().toISOString(),
    data: {
      email_id: "em_2",
      to: [email],
      bounce: { message: "Mailbox does not exist", subType: "NoEmail", type: "Permanent" },
      tags: { campaign_id: "camp_1", workspace_id: "ws_1" },
    },
  });
}

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => makeAdmin(state),
  }));
  const mod = await import("../../src/app/api/webhooks/resend/route");
  POST = mod.POST as (request: NextRequest) => Promise<Response>;
});

afterEach(() => {
  state = createState();
});

describe("POST /api/webhooks/resend", () => {
  it("accepts a correctly signed delivery event and records it", async () => {
    state = createState();
    state.recipient = { id: "cl_1", workspace_id: "ws_1", campaign_id: "camp_1" };

    const res = await POST(buildRequest(deliveredEvent()));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; applied: boolean };
    expect(body.ok).toBe(true);
    expect(body.applied).toBe(true);

    expect(state.emailEvents).toHaveLength(1);
    expect(state.emailEvents[0]).toMatchObject({
      provider: "resend",
      provider_event_id: "msg_test",
      event_type: "email.delivered",
      email: "lead@example.com",
      campaign_id: "camp_1",
      workspace_id: "ws_1",
      signature_valid: true,
    });

    // The recipient moves to delivered.
    const update = state.updates.find((u) => u.table === "campaign_leads");
    expect(update?.values).toMatchObject({ status: "delivered" });
  });

  it("rejects an invalid signature with 401 and applies nothing", async () => {
    state = createState();
    state.recipient = { id: "cl_1", workspace_id: "ws_1", campaign_id: "camp_1" };

    const res = await POST(buildRequest(bouncedEvent(), { sign: false }));
    expect(res.status).toBe(401);

    // Recorded for auditing — with signature_valid false — but never applied.
    expect(state.emailEvents).toHaveLength(1);
    expect(state.emailEvents[0]?.signature_valid).toBe(false);
    expect(state.suppressions).toHaveLength(0);
    expect(state.updates.filter((u) => u.table === "campaign_leads")).toHaveLength(0);
  });

  it("rejects a signature made with a different secret", async () => {
    state = createState();
    const res = await POST(buildRequest(deliveredEvent(), { secret: Buffer.from(randomBytes(24)) }));
    expect(res.status).toBe(401);
    expect(state.emailEvents[0]?.signature_valid).toBe(false);
  });

  it("rejects a request with missing Svix headers", async () => {
    state = createState();
    const request = new NextRequest("https://app.example.com/api/webhooks/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: deliveredEvent(),
    });
    const res = await POST(request);
    expect(res.status).toBe(401);
  });

  it("writes a workspace-wide suppression entry on bounce", async () => {
    state = createState();
    state.recipient = { id: "cl_1", workspace_id: "ws_1", campaign_id: "camp_1" };

    const res = await POST(buildRequest(bouncedEvent()));
    expect(res.status).toBe(200);

    expect(state.suppressions).toEqual([
      expect.objectContaining({
        workspace_id: "ws_1",
        email: "lead@example.com",
        reason: "bounced",
        source: "resend_bounce",
      }),
    ]);

    // And the recipient is marked terminal, with no further scheduling.
    const update = state.updates.find((u) => u.table === "campaign_leads");
    expect(update?.values).toMatchObject({ status: "bounced", next_run_at: null });
  });

  it("treats a spam complaint as the strongest stop signal", async () => {
    state = createState();
    state.recipient = { id: "cl_1", workspace_id: "ws_1", campaign_id: "camp_1" };

    const payload = JSON.stringify({
      type: "email.complained",
      data: { email_id: "em_3", to: ["lead@example.com"], tags: { campaign_id: "camp_1", workspace_id: "ws_1" } },
    });

    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(200);
    expect(state.suppressions[0]).toMatchObject({ reason: "complained", source: "resend_complaint" });
  });

  it("suppresses on bounce even when no campaign recipient row can be resolved", async () => {
    state = createState();
    state.recipient = null;

    const res = await POST(buildRequest(bouncedEvent()));
    expect(res.status).toBe(200);
    // The address is still suppressed: the tag supplies the workspace.
    expect(state.suppressions[0]).toMatchObject({ workspace_id: "ws_1", email: "lead@example.com" });
  });

  it("applies a replayed delivery once and acknowledges the duplicate", async () => {
    state = createState();
    state.recipient = { id: "cl_1", workspace_id: "ws_1", campaign_id: "camp_1" };

    const payload = bouncedEvent();
    const first = await POST(buildRequest(payload));
    expect(first.status).toBe(200);
    expect(state.suppressions).toHaveLength(1);

    // The dedupe lookup now finds the stored provider event id, which is what a
    // genuine replay returns on the select.
    state.emailEventSelectResult = state.emailEvents[0];
    const second = await POST(buildRequest(payload));

    expect(second.status).toBe(200);
    const body = (await second.json()) as { ok: boolean; duplicate: boolean };
    expect(body.duplicate).toBe(true);

    // Still exactly one suppression entry and one recorded event.
    expect(state.suppressions).toHaveLength(1);
    expect(state.emailEvents).toHaveLength(1);
  });

  it("records an unhandled event type without guessing at its meaning", async () => {
    state = createState();
    // `contact.created` has no `to`, so there is no recipient to resolve and
    // nothing we could safely infer from it.
    const payload = JSON.stringify({
      type: "contact.created",
      data: { id: "c1", audience_id: "a1", segment_ids: [], email: "x@y.com", unsubscribed: false },
    });

    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { applied: boolean; reason: string | null };
    expect(body.applied).toBe(false);
    expect(body.reason).toBe("unhandled_event_type");

    // Still recorded, so the delivery is auditable.
    expect(state.emailEvents).toHaveLength(1);
    expect(state.emailEvents[0]?.event_type).toBe("contact.created");
    // And it changed nothing outside the audit row itself.
    expect(state.suppressions).toHaveLength(0);
    expect(state.updates.filter((u) => u.table !== "email_events")).toHaveLength(0);
  });

  it("records email.scheduled without touching recipient state", async () => {
    state = createState();
    state.recipient = { id: "cl_1", workspace_id: "ws_1", campaign_id: "camp_1" };

    const payload = JSON.stringify({
      type: "email.scheduled",
      data: { email_id: "em_4", to: ["lead@example.com"], tags: { campaign_id: "camp_1", workspace_id: "ws_1" } },
    });

    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { applied: boolean };
    expect(body.applied).toBe(true);
    expect(state.updates.filter((u) => u.table !== "email_events")).toHaveLength(0);
  });

  it("rejects a malformed JSON body", async () => {
    state = createState();
    const res = await POST(buildRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("does not let a late delivery overwrite a bounce", async () => {
    state = createState();
    state.recipient = { id: "cl_1", workspace_id: "ws_1", campaign_id: "camp_1" };

    await POST(buildRequest(deliveredEvent()));
    const update = state.updates.find((u) => u.table === "campaign_leads");
    // The status guard means only sent/scheduled rows move to delivered.
    expect(update?.filters.status).toEqual(["sent", "scheduled"]);
  });
});
