/**
 * Campaign personalisation (§22).
 *
 * Placeholders are `{{variable}}`. Unknown variables render as an empty string
 * rather than leaking raw template syntax into a sent email.
 */

export const PERSONALIZATION_VARIABLES = [
  "business_name",
  "first_name",
  "city",
  "category",
  "website",
  "rating",
  "review_count",
  "sender_name",
  "sender_company",
  "unsubscribe_link",
] as const;

export type PersonalizationValue = string | number | null | undefined;

export function renderTemplate(
  template: string,
  values: Record<string, PersonalizationValue>,
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

/** Extracts the variables used by a template, for the UI's variable picker. */
export function usedVariables(template: string): string[] {
  const found = template.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) ?? [];
  return [...new Set(found.map((m) => m.replace(/[{}\s]/g, "")))];
}

/** Rejects templates referencing variables we cannot fill. */
export function unknownVariables(template: string): string[] {
  return usedVariables(template).filter(
    (v) => !(PERSONALIZATION_VARIABLES as readonly string[]).includes(v),
  );
}
