/**
 * Development fixtures (§45).
 *
 * Used **only** when `WORKER_DEV_MODE=true` outside production, so that local
 * development never triggers real Google Maps scraping or spends quota.
 *
 * Every record produced here is written to the database with `is_dev_data =
 * true` and is surfaced in the UI with a "development data" badge, so a
 * developer can never mistake it for a real scrape result.
 */

import type { UpstreamPlace } from "./upstream";

const CATEGORIES = [
  "Dentist", "Roofing contractor", "Italian restaurant", "HVAC contractor",
  "Fitness center", "Landscaper", "Law firm", "Auto repair shop",
  "Hair salon", "Veterinarian", "Plumber", "Real estate agency",
];

const CITIES = [
  { city: "Austin", state: "TX", country: "United States", lat: 30.2672, lng: -97.7431 },
  { city: "Denver", state: "CO", country: "United States", lat: 39.7392, lng: -104.9903 },
  { city: "Portland", state: "OR", country: "United States", lat: 45.5152, lng: -122.6784 },
  { city: "Phoenix", state: "AZ", country: "United States", lat: 33.4484, lng: -112.074 },
  { city: "Leeds", state: "West Yorkshire", country: "United Kingdom", lat: 53.8008, lng: -1.5491 },
];

const PREFIXES = ["Riverside", "Summit", "Northgate", "Lakeside", "Copper", "Evergreen", "Harbor", "Cedar", "Union", "Beacon"];
const SUFFIXES = ["Dental Co.", "Roofing LLC", "Kitchen", "Services", "Studio", "Landscaping", "Partners", "Garage", "Salon", "Clinic"];

/** Deterministic PRNG so fixture runs are reproducible in tests. */
function makeRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function generateFixturePlaces(keywords: string[], locations: string[], limit: number): UpstreamPlace[] {
  const random = makeRandom(hashString(`${keywords.join("|")}${locations.join("|")}${limit}`));
  const count = Math.max(5, Math.min(limit, 250));
  const places: UpstreamPlace[] = [];

  for (let i = 0; i < count; i += 1) {
    const geo = CITIES[Math.floor(random() * CITIES.length)] ?? CITIES[0]!;
    const prefix = PREFIXES[Math.floor(random() * PREFIXES.length)] ?? "North";
    const suffix = SUFFIXES[Math.floor(random() * SUFFIXES.length)] ?? "Dental";
    const category = keywords[0] ?? CATEGORIES[Math.floor(random() * CATEGORIES.length)] ?? "Dentist";
    const name = `${prefix} ${suffix}`;
    const slug = `${prefix}-${suffix}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const hasWebsite = random() > 0.25;
    const hasPhone = random() > 0.15;
    const hasEmail = hasWebsite && random() > 0.35;
    const rating = Math.round((3 + random() * 2) * 10) / 10;
    const reviewCount = Math.floor(random() * 400);
    const inputId = locations[0] ?? geo.city;

    // Deliberately includes some duplicate identities so the dedupe path is
    // exercised during development.
    const duplicateOf = i > 0 && random() < 0.06 ? places[Math.floor(random() * i)] ?? null : null;

    const place: UpstreamPlace = {
      input_id: inputId,
      link: `https://www.google.com/maps/place/?q=place_id:dev_place_${duplicateOf ? "dup" : i}_${slug}`,
      title: duplicateOf?.title ?? name,
      category: duplicateOf?.category ?? String(category),
      address: duplicateOf?.address ?? `${100 + i} ${prefix} Street`,
      complete_address: duplicateOf?.complete_address ?? `${100 + i} ${prefix} Street, ${geo.city}, ${geo.state} ${10000 + i}, ${geo.country}`,
      website: duplicateOf?.website ?? (hasWebsite ? `https://www.${slug}.com` : undefined),
      phone: duplicateOf?.phone ?? (hasPhone ? `+1 (${200 + i}) 555-${String(1000 + i).slice(0, 4)}` : undefined),
      emails: duplicateOf?.emails ?? (hasEmail ? [`hello@${slug}.com`] : []),
      review_rating: duplicateOf?.review_rating ?? rating,
      review_count: duplicateOf?.review_count ?? reviewCount,
      latitude: geo.lat + (random() - 0.5) * 0.08,
      longitude: geo.lng + (random() - 0.5) * 0.08,
      cid: `${1000000000000000 + i}`,
      place_id: duplicateOf?.place_id ?? `dev_place_${i}_${slug}`,
      status: random() > 0.94 ? "temporarily_closed" : "open",
      price_range: random() > 0.6 ? "$".repeat(1 + Math.floor(random() * 3)) : undefined,
      plus_code: `${geo.city.slice(0, 4).toUpperCase()}${i}XX+${geo.city.slice(0, 2).toUpperCase()}`,
      about: hasWebsite
        ? { "Social media": [`https://www.facebook.com/${slug}`, `https://www.instagram.com/${slug}`] }
        : undefined,
      thumbnail: hasWebsite ? `https://www.${slug}.com/logo.png` : undefined,
      open_hours: { monday: "9 AM–5 PM", tuesday: "9 AM–5 PM" },
      descriptions: hasWebsite ? `${name} — a ${String(category).toLowerCase()} serving ${geo.city}.` : undefined,
      timezone: "America/Chicago",
      owner: random() > 0.5 ? "Claimed" : undefined,
    };

    places.push(place);
  }

  return places;
}

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
