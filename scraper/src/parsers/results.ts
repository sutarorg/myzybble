/**
 * Parsers for the upstream engine's `-json` output.
 *
 * The scraper writes results incrementally while it runs, so the file may be
 * temporarily truncated mid-line. `parseIncremental` keeps the trailing partial
 * chunk buffered and only yields complete records.
 */

import type { UpstreamPlace } from "../adapter/upstream";

/**
 * The upstream `-json` writer emits one JSON object per line (JSONL). Some
 * builds wrap the whole run in a JSON array; both are handled.
 */
export function parseIncremental(chunk: string, buffer: string): { records: UpstreamPlace[]; buffer: string } {
  const combined = buffer + chunk;
  const lines = combined.split("\n");
  const trailing = lines.pop() ?? "";

  const records: UpstreamPlace[] = [];
  for (const line of lines) {
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed || trimmed === "[" || trimmed === "]") continue;
    const record = safeParse(trimmed);
    if (record) records.push(record);
  }

  return { records, buffer: trailing };
}

export function parseComplete(text: string): UpstreamPlace[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? (parsed as UpstreamPlace[]) : [];
    } catch {
      // Fall through to JSONL parsing: the run may have been cut mid-array.
    }
  }

  const { records } = parseIncremental(text, "");
  return records;
}

function safeParse(line: string): UpstreamPlace | null {
  try {
    const value = JSON.parse(line);
    if (!value || typeof value !== "object") return null;
    return value as UpstreamPlace;
  } catch {
    return null;
  }
}

/** Coerces a value that upstream may deliver as string or number. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => toStringValue(v))
      .filter((v): v is string => Boolean(v));
  }
  const single = toStringValue(value);
  return single ? [single] : [];
}
