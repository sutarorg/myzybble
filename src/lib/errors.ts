/**
 * Typed application errors.
 *
 * `toErrorResponse()` produces the *only* shape the browser ever sees: a stable
 * machine code, a human message, and a request id for support. Stack traces and
 * provider messages never leave the server (§27 error sanitisation).
 */

import { newRequestId } from "@/lib/logger";

export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "rate_limited"
  | "quota_exceeded"
  | "conflict"
  | "dependency_unavailable"
  | "provider_error"
  | "internal_error";

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 422,
  rate_limited: 429,
  quota_exceeded: 402,
  conflict: 409,
  dependency_unavailable: 503,
  provider_error: 502,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId: string;

  constructor(code: ErrorCode, message: string, options: { details?: unknown; cause?: unknown } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = options.details;
    this.requestId = newRequestId();
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
  }
}

export const Errors = {
  unauthenticated: (message = "You must be signed in to do that.") =>
    new AppError("unauthenticated", message),
  forbidden: (message = "You don't have access to that.") => new AppError("forbidden", message),
  notFound: (message = "That resource doesn't exist.") => new AppError("not_found", message),
  validation: (message = "Some fields are invalid.", details?: unknown) =>
    new AppError("validation_error", message, { details }),
  rateLimited: (retryAfterMs = 60_000) =>
    new AppError("rate_limited", "Too many requests. Please slow down.", { details: { retry_after_ms: retryAfterMs } }),
  quotaExceeded: (message = "You've reached your plan's monthly lead limit.", details?: unknown) =>
    new AppError("quota_exceeded", message, { details }),
  conflict: (message = "That resource already exists.") => new AppError("conflict", message),
  dependency: (message: string) => new AppError("dependency_unavailable", message),
  provider: (message = "A third-party service failed. Please try again.") =>
    new AppError("provider_error", message),
  internal: (message = "Something went wrong on our side.") => new AppError("internal_error", message),
};

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    request_id: string;
    details?: unknown;
  };
}

export function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        request_id: error.requestId,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }
  const fallback = Errors.internal();
  return {
    error: {
      code: fallback.code,
      message: fallback.message,
      request_id: fallback.requestId,
    },
  };
}

export function errorStatus(error: unknown): number {
  return error instanceof AppError ? error.status : 500;
}
