import { describe, it, expect } from "vitest";
import {
  buildDedupeKey,
  fallbackDedupeKey,
  normalizeBusinessName,
  normalizeAddress,
  mergeNonEmpty,
  hash,
} from "@/lib/normalization/dedupe";
import { canonicalDomain, isGoogleOwnedUrl, safeHttpUrl } from "@/lib/normalization/domain";

describe("canonicalDomain", () => {
  it("strips scheme, www, path and query", () => {
    expect(canonicalDomain("https://www.BrightSmile.com/about?utm=x")).toBe("brightsmile.com");
  });

  it("adds a scheme when missing", () => {
    expect(canonicalDomain("brightsmile.com")).toBe("brightsmile.com");
  });

  it("strips tracking subdomains", () => {
    expect(canonicalDomain("https://booking.dentist.co.uk")).toBe("dentist.co.uk");
    expect(canonicalDomain("https://shop.acme.com")).toBe("acme.com");
  });

  it("keeps three labels for multi-part public suffixes", () => {
    expect(canonicalDomain("https://www.example.co.uk")).toBe("example.co.uk");
    expect(canonicalDomain("https://foo.bar.com.au")).toBe("bar.com.au");
  });

  it("reduces deeper subdomains to the registrable root", () => {
    expect(canonicalDomain("https://a.b.c.example.com")).toBe("example.com");
  });

  it("returns null for empty or unusable input", () => {
    expect(canonicalDomain(null)).toBeNull();
    expect(canonicalDomain("")).toBeNull();
    expect(canonicalDomain("   ")).toBeNull();
  });
});

describe("isGoogleOwnedUrl", () => {
  it("recognises Google-hosted links that are not a business site", () => {
    expect(isGoogleOwnedUrl("https://maps.google.com/place")).toBe(true);
    expect(isGoogleOwnedUrl("https://lh3.googleusercontent.com/p/abc")).toBe(true);
    expect(isGoogleOwnedUrl("https://g.page/r/xyz")).toBe(true);
  });

  it("does not flag a real business domain", () => {
    expect(isGoogleOwnedUrl("https://brightsmile.com")).toBe(false);
  });
});

describe("safeHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(safeHttpUrl("example.com")).toBe("https://example.com/");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects javascript: and data: URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
  });
});

describe("normalizeBusinessName", () => {
  it("removes legal suffixes and punctuation", () => {
    expect(normalizeBusinessName("Bright Smile Dental, LLC")).toBe("bright smile dental");
    expect(normalizeBusinessName("Acme & Co.")).toBe("acme");
  });

  it("strips diacritics", () => {
    expect(normalizeBusinessName("Café Crème")).toBe("cafe creme");
  });
});

describe("normalizeAddress", () => {
  it("expands and removes street-type tokens", () => {
    const a = normalizeAddress("123 Main Street, Suite 4");
    expect(a).not.toMatch(/\bstreet\b/);
    expect(a).toMatch(/123 main/);
  });
});

describe("buildDedupeKey", () => {
  it("prefers the upstream source id", () => {
    const id = buildDedupeKey({
      sourceId: "ChIJ_abc123XYZ",
      website: "https://brightsmile.com",
      phone: "+1 555 0100",
      businessName: "Bright Smile",
    });
    expect(id?.signal).toBe("source_id");
    expect(id?.key).toBe("src:chij_abc123xyz");
  });

  it("falls back to the canonical domain", () => {
    const id = buildDedupeKey({
      website: "https://www.brightsmile.com/about",
      businessName: "Bright Smile",
    });
    expect(id?.signal).toBe("domain");
    expect(id?.key).toBe("dom:brightsmile.com");
  });

  it("never uses a Google-owned URL as an identity", () => {
    const id = buildDedupeKey({
      website: "https://maps.google.com/place/xyz",
      businessName: "Bright Smile Dental",
      city: "Berlin",
    });
    expect(id?.signal).not.toBe("domain");
  });

  it("falls back to the normalised phone number", () => {
    const id = buildDedupeKey({
      phone: "+1 (555) 010-0000",
      businessName: "Some Business",
    });
    expect(id?.signal).toBe("phone");
    expect(id?.key.startsWith("tel:+15550100000")).toBe(true);
  });

  it("falls back to name + address", () => {
    const id = buildDedupeKey({
      businessName: "Bright Smile Dental LLC",
      address: "12 Hauptstrasse",
    });
    expect(id?.signal).toBe("name_address");
    expect(id?.key.startsWith("nam:bright smile dental|")).toBe(true);
  });

  it("returns null when the record is too sparse", () => {
    expect(buildDedupeKey({ businessName: "A" })).toBeNull();
    expect(buildDedupeKey({})).toBeNull();
  });

  it("produces the same key for cosmetic variations of one business", () => {
    const a = buildDedupeKey({
      sourceId: "PLACE-1",
      website: "https://brightsmile.com",
    });
    const b = buildDedupeKey({
      sourceId: "place-1",
      website: "https://www.brightsmile.com",
    });
    expect(a?.key).toBe(b?.key);
  });
});

describe("fallbackDedupeKey", () => {
  it("is deterministic across calls", () => {
    const a = fallbackDedupeKey({ businessName: "No Data Co", city: "Austin" });
    const b = fallbackDedupeKey({ businessName: "No Data Co", city: "Austin" });
    expect(a).toBe(b);
  });

  it("differs for different businesses", () => {
    const a = fallbackDedupeKey({ businessName: "Alpha", city: "Austin" });
    const b = fallbackDedupeKey({ businessName: "Beta", city: "Austin" });
    expect(a).not.toBe(b);
  });
});

describe("hash", () => {
  it("is stable and differentiates inputs", () => {
    expect(hash("zybble")).toBe(hash("zybble"));
    expect(hash("zybble")).not.toBe(hash("zybble2"));
  });

  it("returns a base36 string with no padding surprises", () => {
    expect(hash("")).toMatch(/^[0-9a-z]+$/);
    expect(hash("")).toBe(hash(""));
  });
});

describe("mergeNonEmpty", () => {
  it("fills blanks but never overwrites existing values", () => {
    const merged = mergeNonEmpty<Record<string, unknown>>(
      { website: "https://a.com", phone: null, notes: "" },
      { website: "https://b.com", phone: "+15550100", notes: "hello" },
    );
    expect(merged.website).toBe("https://a.com");
    expect(merged.phone).toBe("+15550100");
    expect(merged.notes).toBe("hello");
  });

  it("ignores empty arrays and empty objects", () => {
    const merged = mergeNonEmpty<Record<string, unknown>>(
      { tags: [], meta: {} },
      { tags: [], meta: {} },
    );
    expect(merged.tags).toEqual([]);
    expect(merged.meta).toEqual({});
  });

  it("replaces an empty array with a populated one", () => {
    const merged = mergeNonEmpty<Record<string, unknown>>({ tags: [] }, { tags: ["vip"] });
    expect(merged.tags).toEqual(["vip"]);
  });
});
