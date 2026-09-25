import { describe, it, expect } from "vitest";
import { UPSTREAM, buildArgs, buildQueries } from "../../scraper/src/adapter/upstream";
import { normalizePlace } from "../../scraper/src/normalization/map-place";
import type { UpstreamPlace } from "../../scraper/src/adapter/upstream";

/**
 * Scraper adapter tests.
 *
 * These guard the contract with the pinned upstream engine: the flags we send
 * must be real flags, and our own filters must stay in our own code.
 */

const baseRequest = {
  queries: ["dentist in Berlin"],
  limit: 500,
  language: "en",
  depth: 2,
  concurrency: 2,
  extractEmails: true,
  inactivity: "3m",
  pagesPerBrowser: 3,
};

describe("upstream pin", () => {
  it("records the exact version and commit we verified", () => {
    expect(UPSTREAM.version).toBe("v1.18.1");
    expect(UPSTREAM.commit).toBe("549e4b5e61c7103685ef8392f246ebdba783ed03");
    expect(UPSTREAM.image).toBe("gosom/google-maps-scraper:v1.18.1");
  });

  it("models Google's ~120 result cap per query", () => {
    expect(UPSTREAM.maxResultsPerQuery).toBe(120);
  });
});

describe("buildArgs", () => {
  it("always passes input, results and json output", () => {
    const args = buildArgs(baseRequest, "/tmp/in.txt", "/tmp/out.json");
    expect(args).toContain("-input");
    expect(args).toContain("/tmp/in.txt");
    expect(args).toContain("-results");
    expect(args).toContain("/tmp/out.json");
    expect(args).toContain("-json");
  });

  it("uses every flag with a value in flag-then-value pairs", () => {
    const args = buildArgs(baseRequest, "/tmp/in", "/tmp/out");
    const valued = new Set(["-input", "-results", "-lang", "-depth", "-c", "-pages-per-browser", "-exit-on-inactivity", "-radius", "-zoom", "-geo", "-proxies"]);
    let i = 0;
    while (i < args.length) {
      const token = args[i]!;
      expect(token.startsWith("-")).toBe(true);
      i += valued.has(token) ? 2 : 1;
    }
  });

  it("adds -email only when email extraction is requested", () => {
    expect(buildArgs({ ...baseRequest, extractEmails: true }, "i", "o")).toContain("-email");
    expect(buildArgs({ ...baseRequest, extractEmails: false }, "i", "o")).not.toContain("-email");
  });

  it("adds -radius, -zoom, -geo and -proxies only when provided", () => {
    const args = buildArgs(
      { ...baseRequest, radiusMeters: 5000, zoom: 14, geo: "52.52,13.40", proxies: ["a", "b"] },
      "i",
      "o",
    );
    expect(args).toContain("-radius");
    expect(args[args.indexOf("-radius") + 1]).toBe("5000");
    expect(args[args.indexOf("-zoom") + 1]).toBe("14");
    expect(args[args.indexOf("-geo") + 1]).toBe("52.52,13.40");
    expect(args[args.indexOf("-proxies") + 1]).toBe("a,b");
  });

  it("omits optional flags when they are absent", () => {
    const args = buildArgs(baseRequest, "i", "o");
    for (const flag of ["-radius", "-zoom", "-geo", "-proxies"]) {
      expect(args).not.toContain(flag);
    }
  });

  /**
   * The upstream CLI has no min-rating / require-website / require-phone /
   * require-email / business-status flags. Those are Zybble filters applied in
   * the worker — sending a made-up flag would make the engine exit non-zero, or
   * worse, silently ignore it and return unfiltered data.
   */
  it("never invents unsupported flags", () => {
    const args = buildArgs(baseRequest, "i", "o");
    const invented = ["-min-rating", "-min_rating", "-require-website", "-require-email", "-require-phone", "-business-status", "-min-reviews", "-limit"];
    for (const flag of invented) {
      expect(args).not.toContain(flag);
    }
  });
});

describe("buildQueries", () => {
  it("produces the keyword × location matrix", () => {
    const queries = buildQueries(["dentist", "orthodontist"], ["Berlin", "Munich"], 1000);
    expect(queries).toContain("dentist in Berlin");
    expect(queries).toContain("dentist in Munich");
    expect(queries).toContain("orthodontist in Berlin");
    expect(queries).toContain("orthodontist in Munich");
  });

  it("omits the location when none is given", () => {
    expect(buildQueries(["dentist"], [], 100)).toEqual(["dentist"]);
  });

  it("omits the keyword when none is given", () => {
    expect(buildQueries([], ["Berlin"], 100)).toEqual(["Berlin"]);
  });

  it("drops empty entries entirely", () => {
    expect(buildQueries([], [], 100)).toEqual([]);
  });

  it("does not cap the matrix below what the limit needs", () => {
    // 600 results / 120 per query = at least 5 queries' worth of fan-out.
    const queries = buildQueries(["dentist"], ["Berlin", "Munich", "Hamburg", "Koln", "Frankfurt", "Stuttgart"], 600);
    expect(queries.length).toBeGreaterThanOrEqual(5);
  });
});

describe("normalizePlace", () => {
  const place: UpstreamPlace = {
    place_id: "ChIJ_abc",
    cid: "1234567890123456",
    title: "Bright Smile Dental LLC",
    category: "Dentist",
    website: "https://www.brightsmile.com/about",
    phone: "+1 (303) 555-0127",
    emails: ["info@brightsmile.com"],
    review_rating: 4.6,
    review_count: 210,
    complete_address: "12 Hauptstrasse, Berlin, BE 10115, Germany",
    address: "12 Hauptstrasse",
    latitude: 52.52,
    longitude: 13.4,
    status: "open",
    link: "https://www.google.com/maps/place/?q=place_id:ChIJ_abc",
  };

  it("maps a full record into a normalised lead", () => {
    const lead = normalizePlace(place);
    expect(lead).not.toBeNull();
    expect(lead!.businessName).toBe("Bright Smile Dental LLC");
    expect(lead!.sourceId).toBe("ChIJ_abc");
    expect(lead!.emails[0]?.email).toBe("info@brightsmile.com");
    expect(lead!.rating).toBe(4.6);
    expect(lead!.reviewCount).toBe(210);
  });

  it("parses the address into its parts", () => {
    const lead = normalizePlace(place)!;
    expect(lead.city).toBe("Berlin");
    expect(lead.country).toBe("Germany");
  });

  it("normalises the phone number", () => {
    const lead = normalizePlace(place)!;
    expect(lead.phones[0]?.e164).toContain("3035550127");
  });

  it("scores a complete contactable business highly", () => {
    const rich = normalizePlace(place)!;
    const sparse = normalizePlace({
      place_id: "sparse-1",
      title: "Unnamed Shop",
      review_rating: 3.0,
      review_count: 1,
    })!;
    expect(rich.leadScore).toBeGreaterThan(sparse.leadScore);
  });

  it("rejects a record with no name", () => {
    expect(normalizePlace({ place_id: "x", review_rating: 4 })).toBeNull();
    expect(normalizePlace({ place_id: "x", title: "   " })).toBeNull();
  });

  it("falls back to cid or data_id when place_id is missing", () => {
    const lead = normalizePlace({ title: "Fallback Co", cid: "999888777" })!;
    expect(lead.sourceId).toBe("999888777");
  });

  it("captures a dedupe identity from the strongest signal available", () => {
    const withId = normalizePlace(place)!;
    expect(withId.dedupeKey.startsWith("src:")).toBe(true);

    const noId = normalizePlace({ title: "Only Domain Co", website: "https://onlydomain.com" })!;
    expect(noId.dedupeKey).toContain("onlydomain.com");
  });
});
