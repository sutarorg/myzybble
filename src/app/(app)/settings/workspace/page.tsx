import { requireAuthContext } from "@/server/auth";
import { getWorkspace, listMembers } from "@/server/services/settings";
import { Card, Badge } from "@/components/app/primitives";
import WorkspaceForm from "@/features/settings/WorkspaceForm";

export const metadata = { title: "Workspace" };

export default async function WorkspaceSettingsPage() {
  const ctx = await requireAuthContext();
  const [workspace, members] = await Promise.all([
    getWorkspace(ctx.workspaceId),
    listMembers(ctx.workspaceId),
  ]);

  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="space-y-6">
      <WorkspaceForm
        name={workspace?.name ?? ctx.workspace.name}
        billingEmail={workspace?.billing_email ?? null}
        canEdit={canEdit}
      />

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight">Members</h2>
          <span className="font-mono text-[11px] text-ink/45">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>
        <ul className="mt-4 divide-y divide-ink/8">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.fullName ?? member.email}
                  {member.userId === ctx.user.id && (
                    <span className="ml-2 font-mono text-[10.5px] text-ink/40">you</span>
                  )}
                </p>
                <p className="truncate font-mono text-[11px] text-ink/45">{member.email}</p>
              </div>
              <Badge tone={member.role === "owner" ? "lime" : "neutral"}>{member.role}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink/45">
          Seats are part of your plan&apos;s entitlement. Invites are rolled out with team billing —
          ask support to add a member in the meantime.
        </p>
      </Card>
    </div>
  );
}
