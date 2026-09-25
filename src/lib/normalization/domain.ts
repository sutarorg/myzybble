/**
 * Canonical domain extraction.
 *
 * Used for deduplication and for deciding which website belongs to which
 * business. Conservative by design: subdomains that carry meaning (e.g. a
 * booking page) are stripped to the registrable root.
 */

const PUBLIC_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "sch.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "com.br", "com.mx", "co.za", "com.sg", "com.hk", "co.in",
  "co.jp", "ne.jp", "or.jp", "com.tr", "com.tw", "com.cn", "com.ar",
  "ca", "de", "fr", "it", "es", "nl", "se", "no", "dk", "fi", "pl", "pt", "ie", "ch", "at", "be",
]);

const TRACKING_PREFIXES = ["www.", "m.", "mobile.", "en.", "shop.", "blog.", "book.", "booking."];

/** Lowercases, strips scheme/credentials/port/path/query and tracking prefixes. */
export function canonicalDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;

  let hostname: string;
  try {
    hostname = new URL(value).hostname;
  } catch {
    return null;
  }

  if (!hostname) return null;
  hostname = hostname.replace(/^\[|\]$/g, "");
  if (!hostname.includes(".")) return hostname; // e.g. localhost

  for (const prefix of TRACKING_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      hostname = hostname.slice(prefix.length);
      break;
    }
  }

  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");

  const lastTwo = parts.slice(-2).join(".");
  if (PUBLIC_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

/** Absolute, http(s)-only URL, or null when unsafe/invalid. */
export function safeHttpUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** True for Google-hosted links that are not a business's own website. */
export function isGoogleOwnedUrl(input: string | null | undefined): boolean {
  const domain = canonicalDomain(input);
  if (!domain) return false;
  return (
    domain === "google.com" ||
    domain.endsWith(".google.com") ||
    domain === "googleusercontent.com" ||
    domain.endsWith(".googleusercontent.com") ||
    domain === "g.page" ||
    domain === "goo.gl" ||
    domain === "maps.app.goo.gl" ||
    domain === "gstatic.com" ||
    domain.endsWith(".gstatic.com")
  );
}
