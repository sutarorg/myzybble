/**
 * Structured logging (§32).
 *
 * Every log line is a single JSON object with correlation ids so that a
 * production incident can be traced from a request, through a job, into the
 * worker. Secrets are never logged: `redact()` strips known sensitive keys and
 * anything that looks like a token.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  request_id?: string;
  user_id?: string;
  workspace_id?: string;
  job_id?: string;
  worker_id?: string;
  event?: string;
  status?: string;
  duration_ms?: number;
  error_code?: string;
  route?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY = /(authorization|password|passwd|secret|token|api[-_]?key|cookie|signature|credential|refresh_token|access_token|smtp)/i;
const SENSITIVE_VALUE = /(^|[\s"'])(re_[A-Za-z0-9_-]{8,}|rzp_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(SENSITIVE_VALUE, "$1[redacted]")
      .replace(/(postgres(?:ql)?:\/\/)[^@]*@/i, "$1[redacted]@");
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redactValue(v);
    }
    return out;
  }
  return value;
}

function emit(level: LogLevel, message: string, context: LogContext = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    service: context.worker_id ? "worker" : "web",
    ...(redactValue(context) as Record<string, unknown>),
  };

  const serialised = JSON.stringify(line);
  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else if (level === "debug" && process.env.NODE_ENV !== "production") console.debug(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
  /** Wraps an async block and logs its duration plus any failure. */
  async time<T>(event: string, context: LogContext, fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      const result = await fn();
      emit("info", event, { ...context, event, status: "ok", duration_ms: Date.now() - started });
      return result;
    } catch (error) {
      emit("error", event, {
        ...context,
        event,
        status: "error",
        duration_ms: Date.now() - started,
        error_code: error instanceof Error ? error.name : "UnknownError",
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

/** Short, human-quotable id that a user can paste into a support request. */
export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Normalises unknown thrown values into a safe, loggable shape. */
export function describeError(error: unknown): { name: string; message: string; code?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as { code?: string }).code,
    };
  }
  return { name: "UnknownError", message: String(error) };
}
