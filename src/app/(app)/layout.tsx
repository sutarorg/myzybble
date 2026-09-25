import type { Metadata } from "next";
import AppShell from "@/components/app/AppShell";
import { requireAuthContext } from "@/server/auth";
import { getEntitlements, recomputeEntitlements } from "@/server/services/usage";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s — zybble" },
  robots: { index: false, follow: false },
};

/**
 * Authenticated application layout.
 *
 * Runs on the server for every protected route: it validates the session
 * (middleware already has), resolves the workspace membership and loads the
 * authoritative entitlement row. Nothing here trusts a client-supplied plan,
 * quota or role.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuthContext();

  let entitlements = ctx.entitlements;
  if (!entitlements) {
    // First access after signup: create the row from the current subscription.
    entitlements = await recomputeEntitlements(ctx.workspaceId);
  }

  const snapshot = entitlements
    ? {
        planName: entitlements.plan_name,
        leadsUsed: Number(entitlements.leads_used),
        monthlyLeads: Number(entitlements.monthly_leads),
        leadsRemaining: Number(entitlements.leads_remaining),
      }
    : await getEntitlements(ctx.workspaceId).then((s) => ({
        planName: s.planName,
        leadsUsed: s.leadsUsed,
        monthlyLeads: s.monthlyLeads,
        leadsRemaining: s.leadsRemaining,
      }));

  return (
    <AppShell
      user={{
        email: ctx.user.email,
        fullName: ctx.profile.full_name,
        avatarUrl: ctx.profile.avatar_url,
      }}
      workspace={{ id: ctx.workspace.id, name: ctx.workspace.name, role: ctx.role }}
      entitlements={snapshot}
      devMode={publicEnv.devMode}
    >
      {children}
    </AppShell>
  );
}
