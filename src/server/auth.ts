import "server-only";
import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ProfileRow, WorkspaceRow, EntitlementRow, WorkspaceRole } from "@/types/database";

/**
 * Server-side authorisation.
 *
 * This is the second layer of the defence-in-depth model (§14): middleware
 * proves a session exists, this module proves the caller is a member of the
 * workspace they're acting on, and RLS enforces it again in Postgres.
 */

export interface AuthContext {
  user: { id: string; email: string };
  profile: ProfileRow;
  workspaceId: string;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  entitlements: EntitlementRow | null;
}

/**
 * Resolves the authenticated user's profile. Returns null rather than throwing
 * so public pages can render without a session.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

/** Throws 401 when there is no valid session (validated via getUser()). */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const user = await getSessionUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

/** Loads the caller's profile row. */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    logger.error("profile.load_failed", { user_id: userId, event: "profile.load", status: "error", error_code: error.code });
    return null;
  }
  return (data as ProfileRow | null) ?? null;
}

export interface WorkspaceSummary {
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  entitlements: EntitlementRow | null;
}

/** Lists every workspace the user belongs to, most relevant first. */
export async function listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*), entitlements:entitlements(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("workspaces.load_failed", { user_id: userId, event: "workspaces.load", status: "error", error_code: error.code });
    throw Errors.internal("Could not load your workspaces.");
  }

  return (data ?? [])
    .map((row) => {
      const workspace = row.workspace as unknown as WorkspaceRow | WorkspaceRow[] | null;
      const entitlements = row.entitlements as unknown as EntitlementRow | EntitlementRow[] | null;
      const ws = Array.isArray(workspace) ? workspace[0] : workspace;
      if (!ws) return null;
      return {
        workspace: ws,
        role: row.role,
        entitlements: Array.isArray(entitlements) ? (entitlements[0] ?? null) : entitlements,
      };
    })
    .filter((v): v is WorkspaceSummary => v !== null);
}

/**
 * Full authorisation context for an authenticated action.
 *
 * `workspaceId` defaults to the user's primary (first) workspace. Every
 * workspace-scoped service must be called with a workspaceId verified here.
 */
export async function requireAuthContext(workspaceId?: string): Promise<AuthContext> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) throw Errors.forbidden("Your profile is still being set up. Try again in a moment.");

  const memberships = await listWorkspaces(user.id);
  if (memberships.length === 0) {
    throw Errors.forbidden("You don't belong to any workspace yet.");
  }

  const membership = workspaceId
    ? memberships.find((m) => m.workspace.id === workspaceId)
    : memberships[0];

  if (!membership) {
    // Do not leak whether the workspace exists.
    throw Errors.forbidden("You don't have access to that workspace.");
  }

  return {
    user,
    profile,
    workspaceId: membership.workspace.id,
    workspace: membership.workspace,
    role: membership.role,
    entitlements: membership.entitlements,
  };
}

/** Requires owner/admin for destructive or billing operations. */
export async function requireAdminContext(workspaceId?: string): Promise<AuthContext> {
  const ctx = await requireAuthContext(workspaceId);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw Errors.forbidden("Only workspace owners and admins can do that.");
  }
  return ctx;
}

/**
 * Verifies an internal service token (Railway worker → Vercel route).
 * Uses a constant-time comparison so timing doesn't leak the secret.
 */
export function verifyWorkerToken(header: string | null): boolean {
  const secret = process.env.WORKER_API_KEY;
  if (!secret) return false;
  if (!header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  return timingSafeEqual(provided, secret);
}

/**
 * Authorises a scheduled job. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; if the secret isn't configured we
 * refuse rather than leaving the endpoint open.
 *
 * Cron routes are excluded from the session middleware (a scheduler has no
 * session), so this is their only authentication.
 */
export function requireCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("CRON_SECRET is not configured, so scheduled jobs are disabled.");
  }
  const header = request.headers.get("authorization");
  if (!header) throw new Error("Missing Authorization header.");
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!timingSafeEqual(provided, secret)) {
    throw new Error("Invalid cron credentials.");
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
