/**
 * Maps an upstream Google Maps record onto Zybble's normalised lead shape.
 *
 * This is the boundary between the upstream engine and Zybble: nothing below
 * this file knows what a `place_id` or a `cid` is.
 */

import type { UpstreamPlace } from "../adapter/upstream";
import { toNumber, toStringArray, toStringValue } from "../parsers/results";
import { canonicalDomain, safeHttpUrl, isGoogleOwnedUrl } from "../../../src/lib/normalization/domain";
import { normalizePhone, splitPhones } from "../../../src/lib/normalization/phone";
import { assessEmail, extractEmails, emailConfidence, type EmailAssessment } from "../../../src/lib/normalization/email";
import { buildDedupeKey, fallbackDedupeKey, normalizeBusinessName } from "../../../src/lib/normalization/dedupe";

export interface NormalizedEmail {
  email: string;
  status: "unknown" | "invalid" | "risky" | "valid";
  source: string;
  confidence: number;
  reason: string;
}

export interface NormalizedPhoneEntry {
  e164: string;
  raw: string;
  kind: "mobile" | "landline" | "unknown";
}

export interface NormalizedLead {
  source: "google_maps";
  /** Upstream identity: place_id is preferred, cid is the fallback. */
  sourceId: string | null;
  businessName: string;
  category: string | null;
  categories: string[];
  website: string | null;
  mapsUrl: string | null;
  address: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  openingHours: Record<string, unknown> | null;
  description: string | null;
  socialLinks: Record<string, string>;
  logoUrl: string | null;
  priceRange: string | null;
  plusCode: string | null;
  sourceMetadata: Record<string, unknown>;
  leadScore: number;
  emails: NormalizedEmail[];
  phones: NormalizedPhoneEntry[];
  /** Strongest available identity; always set. */
  dedupeKey: string;
  dedupeSignal: "source_id" | "domain" | "phone" | "name_address" | "weak";
}

const SOCIAL_HOSTS: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  twitter: "twitter",
  x: "twitter",
  youtube: "youtube",
  tiktok: "tiktok",
  pinterest: "pinterest",
  yelp: "yelp",
};

/** Extracts social profiles from the `about` block the scraper returns. */
function extractSocialLinks(about: Record<string, string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!about) return out;

  for (const values of Object.values(about)) {
    for (const raw of values ?? []) {
      const url = safeHttpUrl(raw);
      if (!url) continue;
      const domain = canonicalDomain(url);
      if (!domain) continue;
      const root = domain.split(".")[0];
      const key = SOCIAL_HOSTS[root];
      if (key && !out[key]) out[key] = url;
    }
  }
  return out;
}

function parseAddress(
  completeAddress: string | null,
  streetAddress: string | null,
): { street: string | null; city: string | null; state: string | null; country: string | null; postalCode: string | null } {
  const source = completeAddress ?? streetAddress ?? null;
  if (!source) return { street: streetAddress, city: null, state: null, country: null, postalCode: null };

  const parts = source.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { street: streetAddress, city: null, state: null, country: null, postalCode: null };

  const country = parts.length > 1 ? parts[parts.length - 1] : null;
  // US-style: "…, City, ST 12345, Country"
  const stateZip = parts.length > 2 ? parts[parts.length - 2] : null;
  let state: string | null = null;
  let postalCode: string | null = null;

  if (stateZip) {
    const match = stateZip.match(/^([A-Za-z]{2})\s+(\S+)$/);
    if (match) {
      state = match[1].toUpperCase();
      postalCode = match[2];
    } else {
      const zipOnly = stateZip.match(/^(\d{4,6})$/);
      if (zipOnly) postalCode = zipOnly[1];
      else state = stateZip;
    }
  }

  const city = parts.length > 3 ? parts[parts.length - 3] : parts.length > 1 ? parts[0] : null;

  return {
    street: streetAddress,
    city: city && city !== country ? city : null,
    state,
    country,
    postalCode,
  };
}

/**
 * Scores 0–100. Deliberately transparent and data-driven: it rewards contact
 * completeness and reputation, and never invents a value.
 */
function scoreLead(input: {
  website: string | null;
  phones: NormalizedPhoneEntry[];
  emails: NormalizedEmail[];
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
}): number {
  let score = 0;
  if (input.website) score += 20;
  if (input.phones.length) score += 20;

  const validish = input.emails.filter((e) => e.status !== "invalid");
  if (validish.length) score += 20;
  const ownDomain = validish.find((e) => e.confidence >= 0.8);
  if (ownDomain) score += 10;

  if (input.rating !== null) score += Math.round(Math.min(input.rating / 5, 1) * 15);
  if (input.reviewCount !== null) {
    score += Math.round(Math.min(Math.log10(input.reviewCount + 1) / 3, 1) * 15);
  }
  if (input.businessStatus && /closed|permanently/i.test(input.businessStatus)) score -= 40;

  return Math.max(0, Math.min(100, score));
}

function collectEmails(place: UpstreamPlace, businessDomain: string | null): NormalizedEmail[] {
  const candidates = new Set<string>();
  for (const raw of toStringArray(place.emails)) {
    for (const found of extractEmails(raw)) candidates.add(found);
  }
  // `about` sometimes contains a contact address the website crawler missed.
  if (place.about) {
    for (const values of Object.values(place.about)) {
      for (const value of values ?? []) {
        for (const found of extractEmails(value)) candidates.add(found);
      }
    }
  }

  const out: NormalizedEmail[] = [];
  for (const email of candidates) {
    const assessment = assessEmail(email);
    if (!assessment || assessment.verdict === "invalid") {
      // Keep invalid rows out of the lead's contact list entirely.
      continue;
    }
    out.push({
      email: assessment.email,
      status: assessment.verdict,
      source: "website_crawl",
      confidence: emailConfidence(assessment, businessDomain),
      reason: assessment.reason,
    });
  }

  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, 5);
}

export function normalizePlace(place: UpstreamPlace): NormalizedLead | null {
  const businessName = toStringValue(place.title);
  if (!businessName || normalizeBusinessName(businessName).length < 2) return null;

  const websiteRaw = toStringValue(place.website);
  const website = websiteRaw && !isGoogleOwnedUrl(websiteRaw) ? safeHttpUrl(websiteRaw) : null;
  const domain = canonicalDomain(website);

  const phones: NormalizedPhoneEntry[] = [];
  for (const raw of splitPhones(toStringValue(place.phone))) {
    const normalized = normalizePhone(raw);
    if (!normalized) continue;
    if (phones.some((p) => p.e164 === normalized.e164)) continue;
    phones.push({ e164: normalized.e164, raw: normalized.raw, kind: normalized.kind });
  }

  const emails = collectEmails(place, domain);

  const rating = clampRating(toNumber(place.review_rating));
  const reviewCount = toNumber(place.review_count);

  const completeAddress = toStringValue(place.complete_address);
  const streetAddress = toStringValue(place.address);
  const geo = parseAddress(completeAddress, streetAddress);

  const sourceId = toStringValue(place.place_id) ?? toStringValue(place.cid) ?? toStringValue(place.data_id);

  const identity = buildDedupeKey({
    sourceId,
    website,
    phone: phones[0]?.raw,
    businessName,
    address: completeAddress ?? streetAddress,
    city: geo.city,
  });

  const businessStatus = toStringValue(place.status);
  const leadScore = scoreLead({ website, phones, emails, rating, reviewCount, businessStatus });

  const descriptionRaw = place.descriptions;
  const description = Array.isArray(descriptionRaw)
    ? descriptionRaw.filter(Boolean).join(" ").trim() || null
    : toStringValue(descriptionRaw);

  return {
    source: "google_maps",
    sourceId,
    businessName,
    category: toStringValue(place.category),
    categories: toStringArray(place.category ? [place.category] : []),
    website,
    mapsUrl: safeHttpUrl(toStringValue(place.link)),
    address: completeAddress ?? streetAddress,
    street: geo.street,
    city: geo.city,
    state: geo.state,
    country: geo.country,
    postalCode: geo.postalCode,
    latitude: clampLatLng(toNumber(place.latitude), 90),
    longitude: clampLatLng(toNumber(place.longitude), 180),
    rating,
    reviewCount,
    businessStatus,
    openingHours: normalizeOpeningHours(place.open_hours),
    description,
    socialLinks: extractSocialLinks(place.about),
    logoUrl: safeHttpUrl(toStringValue(place.thumbnail)),
    priceRange: toStringValue(place.price_range),
    plusCode: toStringValue(place.plus_code),
    sourceMetadata: {
      cid: toStringValue(place.cid),
      data_id: toStringValue(place.data_id),
      place_id: sourceId,
      timezone: toStringValue(place.timezone),
      reviews_link: safeHttpUrl(toStringValue(place.reviews_link)),
      street_view_url: safeHttpUrl(toStringValue(place.street_view_url)),
      owner: toStringValue(place.owner),
      input_id: toStringValue(place.input_id),
      order_online: safeHttpUrl(toStringValue(place.order_online)),
      reservations: safeHttpUrl(toStringValue(place.reservations)),
      menu: safeHttpUrl(toStringValue(place.menu)),
      credit_cards_accepted: place.credit_cards_accepted ?? null,
      engine: "gosom/google-maps-scraper",
    },
    leadScore,
    emails,
    phones,
    dedupeKey: identity?.key ?? fallbackDedupeKey({ businessName, sourceId, city: geo.city }),
    dedupeSignal: identity?.signal ?? "weak",
  };
}

function normalizeOpeningHours(value: UpstreamPlace["open_hours"]): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  const raw = toStringValue(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return { raw };
  }
}

function clampRating(value: number | null): number | null {
  if (value === null) return null;
  if (value < 0 || value > 5) return null;
  return Math.round(value * 100) / 100;
}

function clampLatLng(value: number | null, max: number): number | null {
  if (value === null) return null;
  if (Math.abs(value) > max) return null;
  return value;
}

/** Re-export so persistence can count verified emails consistently. */
export type { EmailAssessment };
