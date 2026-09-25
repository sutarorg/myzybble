import { describe, it, expect } from "vitest";
import { evaluateConditions } from "@/server/services/automations";

/**
 * `evaluateConditions` is the gate on whether an automation fires at all, so it
 * is tested directly rather than only through the DB-backed runner.
 */

type Lead = Parameters<typeof evaluateConditions>[0];

const lead = (overrides: Partial<Lead> = {}): Lead =>
  ({
    id: "lead-1",
    business_name: "Bright Smile Dental",
    category: "Dentist",
    website: "https://brightsmile.com",
    primary_email: "info@brightsmile.com",
    primary_phone: "+13035550127",
    email_status: "valid",
    rating: 4.6,
    review_count: 210,
    city: "Berlin",
    lead_score: 72,
    ...overrides,
  }) as Lead;

describe("evaluateConditions", () => {
  it("matches everything when there are no conditions", () => {
    expect(evaluateConditions(lead(), [])).toBe(true);
  });

  describe("equality", () => {
    it("compares strings case-insensitively", () => {
      expect(
        evaluateConditions(lead(), [{ field: "city", operator: "eq", value: "berlin" }]),
      ).toBe(true);
      expect(
        evaluateConditions(lead(), [{ field: "city", operator: "eq", value: "Hamburg" }]),
      ).toBe(false);
    });

    it("compares booleans against the strings 'true'/'false'", () => {
      expect(
        evaluateConditions(lead(), [{ field: "has_email", operator: "eq", value: "true" }]),
      ).toBe(true);
      expect(
        evaluateConditions(lead({ primary_email: null }), [
          { field: "has_email", operator: "eq", value: "true" },
        ]),
      ).toBe(false);
      expect(
        evaluateConditions(lead({ primary_email: null }), [
          { field: "has_email", operator: "eq", value: "false" },
        ]),
      ).toBe(true);
    });

    it("supports neq", () => {
      expect(
        evaluateConditions(lead(), [{ field: "city", operator: "neq", value: "Hamburg" }]),
      ).toBe(true);
    });
  });

  describe("numeric comparisons", () => {
    it("supports gte / gt", () => {
      expect(
        evaluateConditions(lead(), [{ field: "rating", operator: "gte", value: 4.5 }]),
      ).toBe(true);
      expect(
        evaluateConditions(lead(), [{ field: "rating", operator: "gt", value: 4.5 }]),
      ).toBe(true);
      expect(
        evaluateConditions(lead({ rating: 4.2 }), [
          { field: "rating", operator: "gte", value: 4.5 },
        ]),
      ).toBe(false);
    });

    it("supports lte / lt", () => {
      expect(
        evaluateConditions(lead(), [{ field: "review_count", operator: "lte", value: 210 }]),
      ).toBe(true);
      expect(
        evaluateConditions(lead(), [{ field: "review_count", operator: "lt", value: 210 }]),
      ).toBe(false);
    });

    it("accepts numeric strings from the rule builder", () => {
      expect(
        evaluateConditions(lead(), [{ field: "lead_score", operator: "gte", value: "70" }]),
      ).toBe(true);
    });

    it("treats a null field as failing a numeric comparison", () => {
      expect(
        evaluateConditions(lead({ rating: null }), [
          { field: "rating", operator: "gte", value: 1 },
        ]),
      ).toBe(false);
    });
  });

  describe("in / contains", () => {
    it("supports in with an array", () => {
      expect(
        evaluateConditions(lead(), [
          { field: "city", operator: "in", value: ["Berlin", "Munich"] },
        ]),
      ).toBe(true);
      expect(
        evaluateConditions(lead(), [{ field: "city", operator: "in", value: ["Paris"] }]),
      ).toBe(false);
    });

    it("supports contains on strings", () => {
      expect(
        evaluateConditions(lead(), [{ field: "category", operator: "contains", value: "dent" }]),
      ).toBe(true);
    });
  });

  describe("email status", () => {
    it("matches on the stored verification state", () => {
      expect(
        evaluateConditions(lead(), [{ field: "email_status", operator: "eq", value: "valid" }]),
      ).toBe(true);
      expect(
        evaluateConditions(lead({ email_status: "unknown" }), [
          { field: "email_status", operator: "eq", value: "valid" },
        ]),
      ).toBe(false);
    });
  });

  describe("combining conditions", () => {
    it("requires ALL conditions to pass (AND semantics)", () => {
      const conditions = [
        { field: "rating" as const, operator: "gte" as const, value: 4.5 },
        { field: "has_email" as const, operator: "eq" as const, value: "true" },
        { field: "city" as const, operator: "eq" as const, value: "Berlin" },
      ];
      expect(evaluateConditions(lead(), conditions)).toBe(true);
      expect(evaluateConditions(lead({ rating: 4.0 }), conditions)).toBe(false);
      expect(evaluateConditions(lead({ primary_phone: null, primary_email: null }), conditions)).toBe(
        false,
      );
    });
  });

  describe("unknown fields and operators", () => {
    it("fails closed on an unknown field", () => {
      expect(
        evaluateConditions(lead(), [
          { field: "not_a_field", operator: "eq", value: "x" },
        ] as never),
      ).toBe(false);
    });

    it("fails closed on an unknown operator", () => {
      expect(
        evaluateConditions(lead(), [
          { field: "city", operator: "matches", value: "Berlin" },
        ] as never),
      ).toBe(false);
    });
  });
});
