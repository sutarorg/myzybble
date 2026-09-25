import { describe, it, expect } from "vitest";
import {
  searchInputSchema,
  leadFiltersSchema,
  paginationSchema,
  bulkLeadActionSchema,
  exportInputSchema,
  campaignInputSchema,
  campaignStepInputSchema,
  mailboxInputSchema,
  automationInputSchema,
  aiChatSchema,
  billingCheckoutSchema,
  parseTokenList,
} from "@/lib/validation";

describe("searchInputSchema", () => {
  it("accepts a normal multi-keyword, multi-location search", () => {
    const parsed = searchInputSchema.parse({
      keywords: ["dentist", "orthodontist"],
      locations: ["Berlin", "Munich"],
      requestedLimit: 500,
      language: "en",
    });
    expect(parsed.locations).toHaveLength(2);
    expect(parsed.requestedLimit).toBe(500);
  });

  it("accepts comma-separated strings and splits them", () => {
    const parsed = searchInputSchema.parse({
      keywords: "dentist, orthodontist",
      locations: "Berlin, Munich",
      requestedLimit: 100,
    });
    expect(parsed.keywords).toEqual(["dentist", "orthodontist"]);
  });

  it("rejects an empty keyword list", () => {
    expect(() =>
      searchInputSchema.parse({ keywords: [], locations: ["Berlin"], requestedLimit: 10 }),
    ).toThrow();
  });

  it("rejects a limit above the maximum", () => {
    expect(() =>
      searchInputSchema.parse({ keywords: ["a"], locations: ["b"], requestedLimit: 999_999 }),
    ).toThrow();
  });

  it("defaults missing optional filters off rather than inventing them", () => {
    const parsed = searchInputSchema.parse({
      keywords: ["dentist"],
      locations: ["Berlin"],
      requestedLimit: 100,
    });
    // `.nullish()` yields `undefined` when absent; both mean "not filtering".
    expect(parsed.minRating ?? null).toBeNull();
    expect(parsed.requireEmail).toBe(false);
    expect(parsed.businessStatus).toBe("all");
  });
});

describe("parseTokenList", () => {
  it("splits on commas and newlines, trims and drops empties", () => {
    expect(parseTokenList("a, b\nc,,  d ")).toEqual(["a", "b", "c", "d"]);
  });

  it("accepts an array as-is", () => {
    expect(parseTokenList(["a", " b "])).toEqual(["a", "b"]);
  });

  it("returns an empty array for null", () => {
    expect(parseTokenList(null)).toEqual([]);
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    expect(paginationSchema.parse({})).toMatchObject({ limit: 50 });
  });

  it("caps the page size", () => {
    expect(() => paginationSchema.parse({ limit: 100_000 })).toThrow();
  });
});

describe("bulkLeadActionSchema", () => {
  it("requires at least one lead id", () => {
    expect(() => bulkLeadActionSchema.parse({ action: "delete", leadIds: [] })).toThrow();
  });

  it("rejects an unknown action", () => {
    expect(() => bulkLeadActionSchema.parse({ action: "nuke", leadIds: ["a"] })).toThrow();
  });
});

describe("exportInputSchema", () => {
  it("requires at least one column", () => {
    expect(() => exportInputSchema.parse({ columns: [] })).toThrow();
  });
});

describe("campaignInputSchema", () => {
  it("applies sane defaults", () => {
    const parsed = campaignInputSchema.parse({ name: "Q4 outreach" });
    expect(parsed.dailyLimit).toBe(200);
    expect(parsed.stopOnReply).toBe(true);
  });

  it("rejects an out-of-range daily limit", () => {
    expect(() => campaignInputSchema.parse({ name: "x", dailyLimit: 50_000 })).toThrow();
  });
});

describe("campaignStepInputSchema", () => {
  it("requires a body for email steps at the call site, but allows null here", () => {
    // The schema is permissive (a `wait` step has no body); the builder UI is
    // what enforces per-kind requirements.
    expect(campaignStepInputSchema.parse({ kind: "wait" }).body).toBeUndefined();
  });

  it("rejects an unknown step kind", () => {
    expect(() => campaignStepInputSchema.parse({ kind: "carrier-pigeon" })).toThrow();
  });
});

describe("mailboxInputSchema", () => {
  it("requires a valid from address", () => {
    expect(() => mailboxInputSchema.parse({ name: "Sales", email: "not-an-email" })).toThrow();
  });

  it("defaults to resend", () => {
    expect(mailboxInputSchema.parse({ name: "Sales", email: "s@x.com" }).provider).toBe("resend");
  });
});

describe("automationInputSchema", () => {
  it("requires at least one action", () => {
    expect(() =>
      automationInputSchema.parse({
        name: "Tag good ones",
        trigger: { type: "search_completed", config: {} },
        actions: [],
      }),
    ).toThrow();
  });

  it("rejects an unknown trigger", () => {
    expect(() =>
      automationInputSchema.parse({
        name: "x",
        trigger: { type: "the_moon_turns_blue", config: {} },
        actions: [{ type: "add_tag", params: { tag: "a" } }],
      }),
    ).toThrow();
  });

  it("accepts a well-formed rule", () => {
    const parsed = automationInputSchema.parse({
      name: "Tag high rated",
      trigger: { type: "search_completed", config: {} },
      conditions: [{ field: "rating", operator: "gte", value: 4 }],
      actions: [{ type: "add_tag", params: { tag: "good" } }],
    });
    expect(parsed.status).toBe("draft");
  });
});

describe("aiChatSchema", () => {
  it("rejects an empty message", () => {
    expect(() => aiChatSchema.parse({ message: "   " })).toThrow();
  });

  it("caps the message length", () => {
    expect(() => aiChatSchema.parse({ message: "x".repeat(10_000) })).toThrow();
  });
});

describe("billingCheckoutSchema", () => {
  it("requires a plan code", () => {
    expect(() => billingCheckoutSchema.parse({ planCode: "" })).toThrow();
  });
});

describe("leadFiltersSchema", () => {
  it("applies defaults for an unfiltered query", () => {
    const parsed = leadFiltersSchema.parse({});
    expect(parsed.sort).toBe("recent");
    expect(parsed.direction).toBe("desc");
  });

  it("rejects an invalid email status", () => {
    expect(() => leadFiltersSchema.parse({ emailStatus: "definitely_real" })).toThrow();
  });
});
