/**
 * Phone normalisation.
 *
 * Business listings produce wildly inconsistent formats ("(303) 555-0127",
 * "+1 303.555.0127", "0303 555 0127"). We keep the raw value for display and
 * derive an E.164-ish canonical form used only for deduplication and matching.
 */

export interface NormalizedPhone {
  e164: string;
  raw: string;
  kind: "mobile" | "landline" | "unknown";
  countryCode: string | null;
}

export function digitsOnly(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Best-effort E.164. Without libphonenumber we handle the common North-American
 * and "+<cc>" cases and fall back to the full digit string, which is still a
 * stable dedupe key even when it isn't strictly dialable.
 */
export function normalizePhone(input: string | null | undefined, defaultCountryCode = "1"): NormalizedPhone | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  let digits = digitsOnly(raw);
  if (!digits) return null;

  let countryCode: string | null = null;

  if (raw.trimStart().startsWith("+")) {
    // Country code is embedded; take the longest plausible prefix.
    for (const length of [3, 2, 1]) {
      if (digits.length > 7 + length) {
        const candidate = digits.slice(0, length);
        if (KNOWN_COUNTRY_CODES.has(candidate)) {
          countryCode = candidate;
          break;
        }
      }
    }
    if (!countryCode) countryCode = digits.slice(0, 1);
  } else {
    digits = `${defaultCountryCode}${digits}`;
    countryCode = defaultCountryCode;
  }

  // Guard against absurd inputs (extensions, garbage).
  if (digits.length < 8 || digits.length > 15) {
    return { e164: digits.slice(0, 15), raw, kind: "unknown", countryCode };
  }

  return { e164: `+${digits}`, raw, kind: guessKind(digits, countryCode), countryCode };
}

function guessKind(digits: string, countryCode: string | null): NormalizedPhone["kind"] {
  // US/CA: NANP has no separate mobile prefix, so we cannot know reliably.
  if (countryCode === "1") return "unknown";
  return "unknown";
}

const KNOWN_COUNTRY_CODES = new Set([
  "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45",
  "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63",
  "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98", "212", "213",
  "216", "218", "220", "221", "233", "234", "254", "255", "256", "263", "297", "298", "299", "350",
  "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374",
  "375", "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421",
  "423", "500", "501", "502", "503", "504", "505", "506", "507", "509", "590", "591", "592", "593",
  "595", "597", "598", "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680",
  "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692", "850", "852", "853",
  "855", "856", "880", "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970",
  "971", "972", "973", "974", "975", "976", "977", "992", "993", "994", "995", "996", "998",
]);

/** Splits a listing's phone field that may contain several numbers. */
export function splitPhones(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    // Listings separate multiple numbers with , ; / | or the words
    // "or" / "ext." / "x". A single number never contains any of these.
    .split(/[,;/|]|\s+(?:or|ext\.?|x)\s+/i)
    .map((s) => s.trim())
    .filter((s) => digitsOnly(s).length >= 7)
    .slice(0, 5);
}
