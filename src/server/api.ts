import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, Errors, errorStatus, toErrorBody } from "@/lib/errors";
import { logger, newRequestId, describeError } from "@/lib/logger";
import { enforceRateLimit, type RateScope } from "@/server/rate-limit";
import { siteUrl } from "@/lib/env-public";

export const MAX_BODY_BYTES = 512 * 1024; // 512 KB request cap (§27)

export interface RouteContext {
  requestId: string;
  route: string;
  /** Dynamic route segments, when the route declares any. */
  params: Record<string, string>;
}

/**
 * Wraps a Route Handler so that every path — success, expected failure and
 * unexpected crash — produces a consistent, sanitised response with a request
 * id, and never leaks a stack trace or provider message to the client.
 */
export function withRoute(
  route: string,
  handler: (request: NextRequest, ctx: RouteContext) => Promise<Response>,
) {
  return async (
    request: NextRequest,
    segment?: { params?: Promise<Record<string, string>> },
  ) => {
    const requestId = request.headers.get("x-request-id") ?? newRequestId();
    const params = (await segment?.params) ?? {};
    const ctx: RouteContext = { requestId, route, params };
    const started = Date.now();

    try {
      const response = await handler(request, ctx);
      response.headers.set("x-request-id", requestId);
      logger.info("http.request", {
        request_id: requestId,
        route,
        event: "http.request",
        status: String(response.status),
        duration_ms: Date.now() - started,
      });
      return response;
    } catch (error) {
      const status = errorStatus(error);
      const body = toErrorBody(error);

      if (status >= 500) {
        logger.error("http.request_failed", {
          request_id: requestId,
          route,
          event: "http.request",
          status: "error",
          duration_ms: Date.now() - started,
          error_code: error instanceof AppError ? error.code : describeError(error).name,
          error_message: describeError(error).message,
        });
      } else {
        logger.warn("http.request_rejected", {
          request_id: requestId,
          route,
          event: "http.request",
          status: String(status),
          duration_ms: Date.now() - started,
          error_code: error instanceof AppError ? error.code : "unknown",
        });
      }

      return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
    }
  };
}

/** Parses and validates a JSON body, enforcing a size cap. */
export async function readJson<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_BODY_BYTES) {
    throw Errors.validation("Request body is too large.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    throw Errors.validation("Request body is too large.");
  }
  if (!raw.trim()) throw Errors.validation("Request body is required.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Errors.validation("Request body must be valid JSON.");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw Errors.validation("Some fields are invalid.", summariseZodError(result.error));
  }
  return result.data;
}

/** Flattens a ZodError into a `{ field: message }` map safe to return. */
export function summariseZodError(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function json<T>(data: T, init?: number | ResponseInit): NextResponse {
  const responseInit: ResponseInit = typeof init === "number" ? { status: init } : (init ?? {});
  return NextResponse.json(data, responseInit);
}

/**
 * Applies a server-side rate limit and sets the standard headers.
 * `identifier` should be a stable server-known value (user id, or client IP for
 * anonymous routes) — never a value the client controls on its own.
 */
export async function guarded(
  scope: RateScope,
  identifier: string,
  ctx: RouteContext,
  response?: Response,
): Promise<void> {
  const result = await enforceRateLimit(scope, identifier, ctx);
  const headers: Record<string, string> = {
    "ratelimit-limit": String(rateLimitOf(scope)),
  };
  if (result.allowed) {
    headers["ratelimit-remaining"] = String(result.remaining);
  } else {
    headers["ratelimit-remaining"] = "0";
    headers["retry-after"] = String(Math.ceil(result.retryAfterMs / 1000));
    if (response) {
      for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
    }
    throw Errors.rateLimited(result.retryAfterMs);
  }
  if (response) for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
}

function rateLimitOf(scope: RateScope): number {
  // Imported lazily to keep the policy table in one place.
  return rateLimitPolicyRef[scope] ?? 0;
}

let rateLimitPolicyRef: Record<string, number> = {};
export function registerRatePolicy(policy: Record<string, number>) {
  rateLimitPolicyRef = policy;
}

/** Best-effort client IP for anonymous rate limiting. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Verifies a `Origin`/`Host` match for state-changing browser requests (§27). */
export function enforceOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser client (webhook, curl).
  const host = request.headers.get("host");
  const allowed = new Set<string>([`https://${host}`, `http://${host}`]);
  // Normalised to an absolute origin, so a mistyped value cannot throw here.
  if (siteUrl) allowed.add(new URL(siteUrl).origin);
  if (process.env.NODE_ENV === "development") {
    allowed.add("http://localhost:3000");
  }
  if (!allowed.has(origin)) {
    throw Errors.forbidden("Cross-origin request rejected.");
  }
}
