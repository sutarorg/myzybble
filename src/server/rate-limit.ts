import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Server-side rate limiting backed by Postgres (§33).
 *
 * Limits must never depend on the client: a disabled button is a UX affordance,
 * not a control. The counter is incremented atomically by a stored function, so
 * concurrent requests cannot race past the limit.
 */

export type RateScope =
  | "auth:login"
  | "auth:signup"
  | "auth:reset"
  | "ai:chat"
  | "leads:search"
  | "leads:export"
  | "campaigns:action"
  | "billing:action"
  | "webhook"
  | "admin:op"
  | "search:create";

const WINDOW_MS = 60_000;

const POLICY: Record<RateScope, { limit: number; windowMs: number }> = {
  "auth:login": { limit: 10, windowMs: 5 * WINDOW_MS },
  "auth:signup": { limit: 5, windowMs: 60 * WINDOW_MS },
  "auth:reset": { limit: 5, windowMs: 15 * WINDOW_MS },
  "ai:chat": { limit: 30, windowMs: WINDOW_MS },
  "leads:search": { limit: 120, windowMs: WINDOW_MS },
  "leads:export": { limit: 10, windowMs: 5 * WINDOW_MS },
  "campaigns:action": { limit: 30, windowMs: WINDOW_MS },
  "billing:action": { limit: 15, windowMs: 5 * WINDOW_MS },
  webhook: { limit: 600, windowMs: WINDOW_MS },
  "admin:op": { limit: 60, windowMs: WINDOW_MS },
  "search:create": { limit: 10, windowMs: 5 * WINDOW_MS },
};

const failures = new Map<string, number>();

/**
 * Enforces `scope` for `identifier` (usually user id, or ip for anonymous
 * routes). Fails *open* if the database is unreachable but logs loudly — a rate
 * limiter outage must not take the product down, but it must be visible.
 */
export async function enforceRateLimit(
  scope: RateScope,
  identifier: string,
  context: { request_id?: string; route?: string } = {},
): Promise<{ allowed: true; remaining: number } | { allowed: false; retryAfterMs: number }> {
  const { limit, windowMs } = POLICY[scope];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("rate_limit_check", {
      p_scope: scope,
      p_identifier: identifier,
      p_limit: limit,
      p_window_ms: windowMs,
    });

    if (error || !data?.[0]) {
      throw error ?? new Error("empty rate limit result");
    }

    const row = data[0];
    if (!row.allowed) {
      logger.warn("rate_limit.exceeded", {
        request_id: context.request_id,
        route: context.route,
        event: "rate_limit.exceeded",
        status: "blocked",
        metadata: { scope, limit, window_ms: windowMs },
      });
      return { allowed: false, retryAfterMs: row.retry_after_ms || windowMs };
    }

    return { allowed: true, remaining: row.remaining };
  } catch (error) {
    const count = (failures.get(scope) ?? 0) + 1;
    failures.set(scope, count);
    logger.error("rate_limit.degraded", {
      request_id: context.request_id,
      route: context.route,
      event: "rate_limit.degraded",
      status: "error",
      error_code: error instanceof Error ? error.name : "UnknownError",
    });
    // Fail open, but only while the dependency is genuinely down.
    return { allowed: true, remaining: limit };
  }
}

/** Throws a 429 AppError when the limit is exceeded. */
export async function requireRateLimit(
  scope: RateScope,
  identifier: string,
  context: { request_id?: string; route?: string } = {},
): Promise<void> {
  const result = await enforceRateLimit(scope, identifier, context);
  if (!result.allowed) throw Errors.rateLimited(result.retryAfterMs);
}

export const rateLimitPolicy = POLICY;
