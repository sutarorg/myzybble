/**
 * Deduplication identity (§9).
 *
 * Identity strength, strongest first:
 *   1. Upstream source id (Google `place_id` / `cid`) — globally unique.
 *   2. Canonical website domain — one business, one site.
 *   3. Normalised primary phone number — a real dialable identity.
 *   4. Normalised business name + normalised address — weakest fallback.
 *
 * The chosen key is namespaced (`src:`, `dom:`, `tel:`, `nam:`) so two different
 * signals can never collide, and so the same key is stable across re-scrapes.
 */

import { canonicalDomain, isGoogleOwnedUrl } from "./domain";
import { normalizePhone, splitPhones } from "./phone";

export type DedupeSignal = "source_id" | "domain" | "phone" | "name_address";

export interface DedupeIdentity {
  key: string;
  signal: DedupeSignal;
}

const NAME_NOISE =
  /\b(llc|ltd|limited|inc|incorporated|co|corp|corporation|plc|gmbh|bv|nv|sa|srl|sarl|pty|pvt|group|holdings|and|the|&)\b/g;

export function normalizeBusinessName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(NAME_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAddress(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|suite|ste|unit|floor|fl)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export interface DedupeInput {
  sourceId?: string | null;
  website?: string | null;
  phone?: string | null;
  businessName?: string | null;
  address?: string | null;
  city?: string | null;
}

/**
 * Returns the strongest identity available, or null when the record is too
 * sparse to dedupe (in which callers may still persist it with a generated key).
 */
export function buildDedupeKey(input: DedupeInput): DedupeIdentity | null {
  const sourceId = input.sourceId?.trim();
  if (sourceId && sourceId.length >= 6) {
    return { key: `src:${sourceId.toLowerCase()}`, signal: "source_id" };
  }

  const domain = canonicalDomain(input.website);
  if (domain && !isGoogleOwnedUrl(input.website) && domain.split(".").length >= 2) {
    return { key: `dom:${domain}`, signal: "domain" };
  }

  const phones = splitPhones(input.phone);
  if (phones.length > 0) {
    const normalized = normalizePhone(phones[0]);
    if (normalized && normalized.e164.length >= 9) {
      return { key: `tel:${normalized.e164}`, signal: "phone" };
    }
  }

  const name = normalizeBusinessName(input.businessName);
  const address = normalizeAddress(input.address ?? input.city);
  if (name.length >= 3 && address.length >= 4) {
    return { key: `nam:${name}|${address}`, signal: "name_address" };
  }
  if (name.length >= 6 && input.city) {
    return { key: `nam:${name}|${normalizeAddress(input.city)}`, signal: "name_address" };
  }

  return null;
}

/**
 * Deterministic fallback key for records too sparse to dedupe properly.
 * Includes the name so two different sparse businesses rarely collide.
 */
export function fallbackDedupeKey(input: DedupeInput): string {
  const name = normalizeBusinessName(input.businessName) || "unknown";
  const sourceId = input.sourceId?.trim().toLowerCase() || "";
  const seed = `${name}|${input.city?.toLowerCase() ?? ""}|${sourceId}`;
  return `weak:${hash(seed)}`;
}

/** FNV-1a — stable across processes, unlike a random id. */
export function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Merges two records, preferring non-empty values from `incoming`. */
export function mergeNonEmpty<T extends Record<string, unknown>>(existing: T, incoming: Partial<T>): T {
  const out: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    const current = out[key];
    const currentEmpty =
      current === null || current === undefined || current === "" ||
      (Array.isArray(current) && current.length === 0) ||
      (typeof current === "object" && !Array.isArray(current) && Object.keys(current as object).length === 0);
    if (currentEmpty) out[key] = value;
  }
  return out as T;
}
