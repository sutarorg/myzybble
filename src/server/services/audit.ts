import "server-only";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * Audit logging (§24, §27, §35).
 *
 * Written with the service-role client because `audit_logs` is intentionally
 * not user-writable through RLS except for reads by admins. Failures are logged
 * but never thrown: auditing must not break the operation it records.
 */

/**
 * Coarse action families. The specific verb is always also recorded in
 * `metadata.verb` when it's more granular than the family (e.g. a campaign
 * transition is action "update", verb "campaign_paused").
 */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "auth"
  | "billing"
  | "export"
  | "admin";

export interface AuditInput {
  workspaceId?: string | null;
  actorUserId?: string | null;
  actorType?: "user" | "system" | "worker" | "admin";
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  request?: NextRequest;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      workspace_id: input.workspaceId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_type: input.actorType ?? "user",
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      request_id: input.requestId ?? null,
      ip: input.request ? clientIp(input.request) : null,
      user_agent: input.request?.headers.get("user-agent")?.slice(0, 300) ?? null,
      changes: (input.changes ?? null) as never,
      metadata: (input.metadata ?? {}) as never,
    });

    if (error) {
      logger.warn("audit.write_failed", {
        workspace_id: input.workspaceId ?? undefined,
        event: "audit.write",
        status: "error",
        error_code: error.code,
      });
    }
  } catch (error) {
    logger.warn("audit.write_error", {
      event: "audit.write",
      status: "error",
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip");
  return ip || null;
}
