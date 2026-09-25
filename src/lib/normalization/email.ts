/**
 * Email handling.
 *
 * Hard rule (§8): an email existing is *not* evidence that it is valid.
 * Syntax + role/disposable heuristics only ever produce `unknown` or
 * `invalid`/`risky`; `valid` can only be set by a real verification result.
 */

export type EmailVerdict = "unknown" | "invalid" | "risky" | "valid";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

const ROLE_LOCAL_PARTS = new Set([
  "admin", "info", "sales", "support", "contact", "hello", "hi", "team", "office",
  "help", "enquiries", "inquiries", "service", "marketing", "billing", "accounts",
  "noreply", "no-reply", "donotreply", "postmaster", "webmaster", "mail", "email",
]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwawaymail.com", "yopmail.com", "trashmail.com", "sharklasers.com",
  "getnada.com", "maildrop.cc", "tempr.email", "dispostable.com",
]);

const FREE_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "proton.me", "protonmail.com", "gmx.com", "gmx.de", "mail.com", "zoho.com",
  "yandex.com", "qq.com", "163.com", "126.com",
]);

export const SENTINEL_DOMAIN = "example.com";
const PLACEHOLDER_LOCALS = new Set(["example", "test", "sample", "email", "yourname", "name", "user", "someone"]);

export interface EmailAssessment {
  email: string;
  localPart: string;
  domain: string;
  syntaxValid: boolean;
  verdict: EmailVerdict;
  isRole: boolean;
  isDisposable: boolean;
  isFreeProvider: boolean;
  /** Deliverability is deliberately *not* claimed here. */
  reason: string;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase().replace(/^mailto:/i, "").replace(/[.,;:]+$/, "");
  return value || null;
}

export function assessEmail(input: string | null | undefined): EmailAssessment | null {
  const email = normalizeEmail(input);
  if (!email) return null;

  const at = email.lastIndexOf("@");
  const localPart = at > 0 ? email.slice(0, at) : "";
  const domain = at > 0 ? email.slice(at + 1) : "";

  const base = { email, localPart, domain };
  const isRole = ROLE_LOCAL_PARTS.has(localPart) || /^(sales|info|support|contact)[-._]?\w*$/.test(localPart);
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);
  const isFreeProvider = FREE_PROVIDERS.has(domain);

  if (!EMAIL_RE.test(email) || email.length > 254 || !domain.includes(".")) {
    return { ...base, syntaxValid: false, verdict: "invalid", isRole, isDisposable, isFreeProvider, reason: "Malformed address." };
  }

  if (isDisposable) {
    return { ...base, syntaxValid: true, verdict: "invalid", isRole, isDisposable, isFreeProvider, reason: "Disposable mailbox provider." };
  }

  if (domain === SENTINEL_DOMAIN || PLACEHOLDER_LOCALS.has(localPart)) {
    return { ...base, syntaxValid: true, verdict: "invalid", isRole, isDisposable, isFreeProvider, reason: "Placeholder address." };
  }

  if (/\.(jpg|jpeg|png|gif|webp|svg|css|js)$/i.test(email) || /^(noreply|no-reply|donotreply)$/.test(localPart)) {
    return { ...base, syntaxValid: true, verdict: "invalid", isRole, isDisposable, isFreeProvider, reason: "Non-deliverable or asset-style address." };
  }

  if (isRole) {
    return { ...base, syntaxValid: true, verdict: "unknown", isRole, isDisposable, isFreeProvider, reason: "Role address — deliverability not yet verified." };
  }

  return { ...base, syntaxValid: true, verdict: "unknown", isRole, isDisposable, isFreeProvider, reason: "Syntax OK — deliverability not yet verified." };
}

/** Extracts candidates from free text (a scraped "about" block, for example). */
export function extractEmails(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of matches) {
    const email = normalizeEmail(match);
    if (!email || seen.has(email)) continue;
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|woff2?)$/i.test(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out.slice(0, 10);
}

/**
 * Scores how confident we are that an email belongs to the business's own
 * domain rather than a free provider or an unrelated third party.
 */
export function emailConfidence(assessment: EmailAssessment, businessDomain: string | null): number {
  if (assessment.verdict === "invalid") return 0;
  if (!businessDomain) return assessment.isFreeProvider ? 0.2 : 0.4;
  if (assessment.domain === businessDomain) return assessment.isRole ? 0.85 : 0.95;
  if (assessment.domain.endsWith(`.${businessDomain}`)) return 0.8;
  return assessment.isFreeProvider ? 0.25 : 0.5;
}
