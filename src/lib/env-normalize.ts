/**
 * Environment-value normalisation and diagnosis.
 *
 * Shared by the web app (`src/lib/env.ts`, which is `server-only`) and by the
 * Railway worker (`scraper/src/config.ts`, a plain Node process). It therefore
 * stays dependency-free and free of Node-only imports — the worker cannot load
 * `server-only` at all.
 *
 * Why this exists: provider dashboards are unforgiving places to paste secrets.
 * People paste whole `KEY="value"` lines out of a `.env` file, add a variable
 * before they have its value, type a bare hostname, or drop an API key into the
 * variable that wants the project URL. Each helper below turns one of those
 * slips into an actionable message — or, where the intent is unambiguous, into
 * the value they meant — instead of an `Invalid URL` from deep inside a client
 * library that fails a *build*, or a deployment that boots and quietly cannot
 * reach anything.
 */

/** A JSON Web Token — Supabase's legacy keys (and most provider keys) are JWTs. */
const JWT = /^eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}$/;

/** Prefixes that only ever appear on a credential, never on a hostname. */
const API_KEY_PREFIX = /^(sb_publishable_|sb_secret_|re_|rzp_|whsec_|AIza|sk[-_])/;

/** Anything with an explicit scheme: `https://`, `postgres://`, … */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/**
 * Make a raw environment value usable:
 *
 *  - surrounding whitespace (including a trailing newline from a paste) goes,
 *  - one layer of matching quotes goes — `"https://x.up.railway.app"` becomes
 *    `https://x.up.railway.app` rather than an unparseable value,
 *  - a blank or whitespace-only string is **unset**, not invalid. This is the
 *    single most common cause of a failed build: a variable that exists in the
 *    dashboard with an empty value is injected as `""`, and `""` is not a URL.
 */
export function normalizeEnvValue(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  let out = value.trim();
  const quote = out[0];
  if (out.length > 1 && (quote === `"` || quote === `'`) && out.endsWith(quote)) {
    out = out.slice(1, -1).trim();
  }
  return out.length === 0 ? undefined : out;
}

/** True when a value is a credential (JWT or a key-prefixed token), not a URL. */
export function looksLikeApiKey(value: string): boolean {
  return JWT.test(value) || API_KEY_PREFIX.test(value);
}

/**
 * `host`, `host:port/path` or a full URL → absolute URL with no trailing slash.
 *
 * A missing scheme is assumed to be `https://`: pasting the bare hostname a
 * dashboard shows you is the natural thing to do, and it is never meant to be a
 * relative URL. Returns `null` for anything that still isn't a usable absolute
 * HTTP(S) URL — including a credential, which would otherwise pass as a
 * syntactically valid hostname — so callers can report it instead of using it.
 */
export function toAbsoluteUrl(value: string): string | null {
  if (looksLikeApiKey(value)) return null;
  const candidate = HAS_SCHEME.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // A single-label host is either a typo or a private-network name — neither
    // resolves from a Vercel function, so don't let it look configured.
    const plausibleHost =
      url.hostname === "localhost" || url.hostname.includes(".") || url.port.length > 0;
    if (!url.hostname || !plausibleHost) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** The `role` claim of a Supabase JWT, or `null` when the value is not one. */
export function jwtRole(token: string): string | null {
  if (!JWT.test(token)) return null;
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== "object") return null;
    const role = (payload as Record<string, unknown>).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

/**
 * The project URL a Supabase API key belongs to, derived from its `ref` claim.
 * Lets us answer "you pasted the key here — the URL you wanted is …" with the
 * exact value, instead of describing where to find it.
 */
export function supabaseProjectUrlFromApiKey(apiKey: string): string | null {
  if (!JWT.test(apiKey)) return null;
  const segment = apiKey.split(".")[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== "object") return null;
    const ref = (payload as Record<string, unknown>).ref;
    return typeof ref === "string" && /^[a-z0-9]{4,}$/.test(ref) ? `https://${ref}.supabase.co` : null;
  } catch {
    return null;
  }
}

/**
 * Why `NEXT_PUBLIC_SUPABASE_URL` can't be used, as a sentence fragment the
 * caller prefixes with the variable name, or `null` when the value is fine.
 */
export function diagnoseSupabaseUrl(value: string): string | null {
  if (looksLikeApiKey(value)) {
    const derived = supabaseProjectUrlFromApiKey(value);
    return derived
      ? `is an API key, not the project URL — the matching URL is ${derived} (docs/deployment.md §8.2)`
      : "is an API key, not the project URL — copy the URL from Supabase → Settings → API Keys (docs/deployment.md §8.2)";
  }
  if (!toAbsoluteUrl(value)) {
    return "is not a usable URL — expected https://<project-ref>.supabase.co (docs/deployment.md §8.2)";
  }
  return null;
}

/**
 * Why `SUPABASE_SERVICE_ROLE_KEY` can't be used. Catches the two mistakes that
 * matter: the web app pasted into the key slot, and the *anon* key pasted into
 * it (which reads as a working deployment that RLS silently empties).
 */
export function diagnoseSupabaseServiceKey(value: string): string | null {
  if (looksLikeApiKey(value)) {
    const role = jwtRole(value);
    if (role && role !== "service_role") {
      return `is a "${role}" key — the server needs the service_role key (Supabase → Settings → API Keys)`;
    }
    return null;
  }
  if (toAbsoluteUrl(value)) {
    return "is a URL, not a key — the service_role key is under Supabase → Settings → API Keys";
  }
  return null;
}

/**
 * Why `NEXT_PUBLIC_SUPABASE_ANON_KEY` must not be used: it is inlined into the
 * browser bundle, so the service-role key would ship to every visitor.
 */
export function diagnoseSupabaseAnonKey(value: string): string | null {
  if (jwtRole(value) === "service_role") {
    return "holds the service_role key — it is inlined into the browser bundle, so replace it with the anon/publishable key and rotate the service_role key";
  }
  return null;
}
