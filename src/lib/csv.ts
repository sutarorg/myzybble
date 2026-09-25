/**
 * RFC 4180 CSV serialisation.
 *
 * Handles the cases that break naive implementations: embedded commas, double
 * quotes (doubled per spec), CR/LF inside values, leading characters that
 * spreadsheet software can execute as formulas, and a UTF-8 BOM so Excel reads
 * accents and non-Latin scripts correctly.
 */

const RISKY_LEAD = /^[=+\-@\t\r]/;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text: string;
  if (Array.isArray(value)) {
    text = value.join("; ");
  } else if (typeof value === "object") {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }

  // Neutralise spreadsheet formula injection.
  if (RISKY_LEAD.test(text)) text = `'${text}`;

  // Normalise newlines so a single cell never contains a raw CR.
  text = text.replace(/\r\n?/g, "\n");

  if (text.includes('"') || text.includes(",") || text.includes("\n") || text.includes("\t")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const BOM = "﻿";

export function csvHeader(columns: string[]): string {
  return columns.map(csvEscape).join(",");
}

export function csvRow(columns: string[], row: Record<string, unknown>): string {
  return columns.map((column) => csvEscape(row[column])).join(",");
}

/** Streaming-friendly: yields the header then one line per row. */
export function* csvLines(
  columns: string[],
  rows: Iterable<Record<string, unknown>>,
  options: { bom?: boolean } = {},
): Generator<string> {
  if (options.bom !== false) yield BOM;
  yield `${csvHeader(columns)}\n`;
  for (const row of rows) {
    yield `${csvRow(columns, row)}\n`;
  }
}

/** Same as `csvLines`, but for async iterables (paged database reads). */
export async function* csvLinesAsync(
  columns: string[],
  rows: AsyncIterable<Record<string, unknown>>,
  options: { bom?: boolean } = {},
): AsyncGenerator<string> {
  if (options.bom !== false) yield BOM;
  yield `${csvHeader(columns)}\n`;
  for await (const row of rows) {
    yield `${csvRow(columns, row)}\n`;
  }
}

/** Column definitions shared by the UI and the exporter. */
export const LEAD_EXPORT_COLUMNS = [
  { key: "business_name", label: "business_name" },
  { key: "category", label: "category" },
  { key: "website", label: "website" },
  { key: "maps_url", label: "maps_url" },
  { key: "address", label: "address" },
  { key: "city", label: "city" },
  { key: "state", label: "state" },
  { key: "country", label: "country" },
  { key: "postal_code", label: "postal_code" },
  { key: "phone", label: "phone" },
  { key: "email", label: "email" },
  { key: "email_status", label: "email_status" },
  { key: "rating", label: "rating" },
  { key: "review_count", label: "review_count" },
  { key: "business_status", label: "business_status" },
  { key: "latitude", label: "latitude" },
  { key: "longitude", label: "longitude" },
] as const;

export const EXPORTABLE_COLUMNS = [
  ...LEAD_EXPORT_COLUMNS.map((c) => c.key),
  "tags",
  "notes",
  "lead_score",
  "source",
  "contacted_at",
  "created_at",
  "opening_hours",
  "plus_code",
  "price_range",
  "social_links",
] as const;

export type ExportableColumn = (typeof EXPORTABLE_COLUMNS)[number];

export function defaultColumns(): string[] {
  return LEAD_EXPORT_COLUMNS.map((c) => c.key) as unknown as string[];
}
