import { requireAuthContext } from "@/server/auth";
import { listAutomations } from "@/server/services/automations";
import { listLists } from "@/server/services/lists";
import { listCampaigns } from "@/server/services/campaigns";
import { SectionTitle } from "@/components/app/primitives";
import AutomationList, { type AutomationDraft } from "@/features/automations/AutomationBuilder";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const ctx = await requireAuthContext();
  const [automations, lists, campaigns] = await Promise.all([
    listAutomations(ctx.workspaceId),
    listLists(ctx.workspaceId),
    listCampaigns(ctx.workspaceId),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle sub="Trigger → conditions → actions. Every run is recorded with an idempotency key so a replayed event never fires twice.">
        Automations
      </SectionTitle>

      <AutomationList
        automations={automations.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description ?? "",
          status: (a.status === "archived" ? "paused" : a.status) as "draft" | "active" | "paused",
          trigger: a.trigger as unknown as AutomationDraft["trigger"],
          conditions:
            (a.conditions as unknown as AutomationDraft["conditions"]) ?? [],
          actions: (a.actions as unknown as AutomationDraft["actions"]) ?? [],
          runsCount: Number(a.runs_count),
          lastRunAt: a.last_run_at,
        }))}
        lists={lists.map((l) => ({ id: l.id, name: l.name }))}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
