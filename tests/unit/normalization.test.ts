import { describe, it, expect } from "vitest";
import { normalizePhone, splitPhones, digitsOnly } from "@/lib/normalization/phone";
import {
  assessEmail,
  normalizeEmail,
  type EmailVerdict,
} from "@/lib/normalization/email";

describe("normalizePhone", () => {
  it("handles an explicit +country code", () => {
    const p = normalizePhone("+1 (303) 555-0127");
    expect(p?.e164).toBe("+13035550127");
    expect(p?.countryCode).toBe("1");
  });

  it("assumes the default country code when none is given", () => {
    const p = normalizePhone("(303) 555-0127", "1");
    expect(p?.e164).toBe("+13035550127");
  });

  it("detects non-US country codes", () => {
    const p = normalizePhone("+49 30 1234567");
    expect(p?.countryCode).toBe("49");
    expect(p?.e164.startsWith("+4930")).toBe(true);
  });

  it("keeps the raw value for display", () => {
    const p = normalizePhone("(303) 555-0127");
    expect(p?.raw).toBe("(303) 555-0127");
  });

  it("produces a stable key for cosmetic variations", () => {
    const a = normalizePhone("+1 303-555-0127");
    const b = normalizePhone("(303) 555.0127");
    expect(a?.e164).toBe(b?.e164);
  });

  it("returns null for empty input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("no digits here")).toBeNull();
  });
});

describe("splitPhones", () => {
  it("splits multiple numbers on common separators", () => {
    const parts = splitPhones("+1 303 555 0127 / +1 303 555 0128");
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it("returns a single entry for one number", () => {
    expect(splitPhones("(303) 555-0127")).toHaveLength(1);
  });

  it("returns an empty array for empty input", () => {
    expect(splitPhones(null)).toEqual([]);
  });
});

describe("digitsOnly", () => {
  it("strips everything but digits", () => {
    expect(digitsOnly("+1 (303) 555-0127")).toBe("13035550127");
    expect(digitsOnly("abc")).toBe("");
  });
});

describe("assessEmail", () => {
  it("rejects malformed addresses", () => {
    const a = assessEmail("not-an-email");
    expect(a?.syntaxValid).toBe(false);
    expect(a?.verdict).toBe("invalid");
  });

  it("rejects disposable providers", () => {
    const a = assessEmail("someone@mailinator.com");
    expect(a?.isDisposable).toBe(true);
    expect(a?.verdict).toBe("invalid");
  });

  it("rejects placeholder addresses", () => {
    expect(assessEmail("test@example.com")?.verdict).toBe("invalid");
    expect(assessEmail("yourname@company.com")?.verdict).toBe("invalid");
  });

  it("rejects no-reply and asset-style addresses", () => {
    expect(assessEmail("noreply@brightsmile.com")?.verdict).toBe("invalid");
    expect(assessEmail("logo@png")?.verdict).toBe("invalid");
  });

  it("flags role addresses but does not call them invalid", () => {
    const a = assessEmail("info@brightsmile.com");
    expect(a?.isRole).toBe(true);
    expect(a?.verdict).not.toBe("invalid");
  });

  it("flags free providers", () => {
    const a = assessEmail("owner@gmail.com");
    expect(a?.isFreeProvider).toBe(true);
  });

  /**
   * The single most important rule in §8: a well-formed address is NOT a
   * verified address. Syntax checks may never produce `valid`.
   */
  it("never claims `valid` without a verification result", () => {
    const addresses = [
      "hello@brightsmile.com",
      "info@brightsmile.com",
      "owner@gmail.com",
      "a.b-c@sub.domain.co.uk",
      "not-an-email",
      "test@example.com",
    ];
    const verdicts: EmailVerdict[] = [];
    for (const address of addresses) {
      const a = assessEmail(address);
      if (a) verdicts.push(a.verdict);
    }
    expect(verdicts).not.toContain("valid");
  });
});

describe("normalizeEmail", () => {
  it("lowercases and strips a mailto: prefix and trailing punctuation", () => {
    expect(normalizeEmail("Mailto:Info@BrightSmile.com")).toBe("info@brightsmile.com");
    expect(normalizeEmail("info@brightsmile.com.")).toBe("info@brightsmile.com");
  });

  it("returns null for blank input", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail("  ")).toBeNull();
  });
});
