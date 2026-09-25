import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { NotificationRow, NotificationType } from "@/types/database";

export interface CreateNotificationInput {
  workspaceId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  severity?: "info" | "success" | "warning" | "error";
  userId?: string | null;
  /** Prevents duplicate notifications for repeated events (§26). */
  dedupeKey?: string | null;
}

/**
 * Persists an in-app notification. Delivery failures never break the caller:
 * a notification is an enhancement, not the transaction.
 */
export async function createNotification(input: CreateNotificationInput): Promise<NotificationRow | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notifications")
      .insert({
        workspace_id: input.workspaceId,
        user_id: input.userId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        severity: input.severity ?? "info",
        dedupe_key: input.dedupeKey ?? null,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      // A duplicate dedupe_key is an expected, benign conflict.
      if (error.code === "23505") return null;
      logger.warn("notification.create_failed", {
        workspace_id: input.workspaceId,
        event: "notification.create",
        status: "error",
        error_code: error.code,
      });
      return null;
    }
    return (data as NotificationRow | null) ?? null;
  } catch (error) {
    logger.warn("notification.create_error", {
      workspace_id: input.workspaceId,
      event: "notification.create",
      status: "error",
      error_message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function listNotifications(workspaceId: string, userId: string, limit = 30): Promise<NotificationRow[]> {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as NotificationRow[] | null) ?? [];
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
  return !error;
}

export async function markAllRead(workspaceId: string, userId: string): Promise<boolean> {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("read_at", null);
  return !error;
}
