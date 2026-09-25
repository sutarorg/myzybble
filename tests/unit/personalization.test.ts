import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  usedVariables,
  unknownVariables,
  PERSONALIZATION_VARIABLES,
} from "@/lib/personalization";

describe("renderTemplate", () => {
  it("substitutes known variables", () => {
    const out = renderTemplate("Hi {{first_name}} at {{business_name}}", {
      first_name: "Maya",
      business_name: "Bright Smile",
    });
    expect(out).toBe("Hi Maya at Bright Smile");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{ first_name }}", { first_name: "Maya" })).toBe("Hi Maya");
  });

  it("renders an empty string for missing values", () => {
    expect(renderTemplate("Hi {{first_name}}!", {})).toBe("Hi !");
  });

  it("renders an empty string for null and undefined", () => {
    expect(renderTemplate("{{a}}{{b}}", { a: null, b: undefined })).toBe("");
  });

  it("stringifies numbers", () => {
    expect(renderTemplate("Rated {{rating}}", { rating: 4.6 })).toBe("Rated 4.6");
  });

  it("leaves a template with no variables untouched", () => {
    expect(renderTemplate("Hello there", {})).toBe("Hello there");
  });

  it("returns empty for an empty template", () => {
    expect(renderTemplate("", { a: 1 })).toBe("");
  });

  it("does not treat unknown placeholders as errors, just blanks them", () => {
    expect(renderTemplate("{{nope}}", {})).toBe("");
  });
});

describe("usedVariables", () => {
  it("lists each variable once, in order of appearance", () => {
    expect(usedVariables("{{a}} and {{b}} and {{a}}")).toEqual(["a", "b"]);
  });

  it("handles whitespace", () => {
    expect(usedVariables("{{ business_name }}")).toEqual(["business_name"]);
  });

  it("returns an empty array when there are none", () => {
    expect(usedVariables("no tokens")).toEqual([]);
  });
});

describe("unknownVariables", () => {
  it("flags variables we cannot fill", () => {
    expect(unknownVariables("{{business_name}} {{not_real}}")).toEqual(["not_real"]);
  });

  it("accepts every documented variable", () => {
    const template = PERSONALIZATION_VARIABLES.map((v) => `{{${v}}}`).join(" ");
    expect(unknownVariables(template)).toEqual([]);
  });
});
