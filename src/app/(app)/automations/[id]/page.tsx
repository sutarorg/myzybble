import { notFound } from "next/navigation";
import { requireAuthContext } from "@/server/auth";
import { getAutomation, listAutomationRuns } from "@/server/services/automations";
import { listLists } from "@/server/services/lists";
import { listCampaigns } from "@/server/services/campaigns";
import { Card, StatCard, Badge, EmptyState } from "@/components/app/primitives";
import AutomationActions from "@/features/automations/AutomationActions";
import { Workflow, CheckCircle2, XCircle, Clock } from "lucide-react";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const automation = await getAutomation(ctx.workspaceId, id);
  if (!automation) notFound();

  const [runs, lists, campaigns] = await Promise.all([
    listAutomationRuns(ctx.workspaceId, id, 50),
    listLists(ctx.workspaceId),
    listCampaigns(ctx.workspaceId),
  ]);

  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const skipped = runs.filter((r) => r.status === "skipped").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-3xl font-bold tracking-[-0.02em]">
              {automation.name}
            </h1>
            <Badge
              tone={
                automation.status === "active"
                  ? "lime"
                  : automation.status === "paused"
                    ? "amber"
                    : "neutral"
              }
            >
              {automation.status}
            </Badge>
          </div>
          {automation.description && (
            <p className="mt-1.5 max-w-2xl text-sm text-ink/55">{automation.description}</p>
          )}
          <p className="mt-2 font-mono text-[11px] text-ink/40">
            created {new Date(automation.created_at).toLocaleDateString()}
            {automation.last_run_at
              ? ` · last run ${new Date(automation.last_run_at).toLocaleString()}`
              : " · never run"}
          </p>
        </div>
        <AutomationActions
          automationId={automation.id}
          status={automation.status}
          lists={lists.map((l) => ({ id: l.id, name: l.name }))}
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            name: automation.name,
            description: automation.description ?? "",
            status: automation.status as "draft" | "active" | "paused",
            trigger: automation.trigger as never,
            conditions: (automation.conditions as never) ?? [],
            actions: (automation.actions as never) ?? [],
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total runs" value={Number(automation.runs_count)} icon={Workflow} />
        <StatCard label="Succeeded" value={succeeded} icon={CheckCircle2} />
        <StatCard label="Failed" value={failed} icon={XCircle} />
        <StatCard label="Skipped" value={skipped} icon={Clock} />
      </div>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Run history</h2>
        {runs.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="No runs yet"
            body="This automation runs when its trigger fires. History appears here."
          />
        ) : (
          <ul className="mt-4 divide-y divide-ink/8">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-ink/45">{run.trigger_event}</p>
                  <p className="truncate text-sm">
                    {run.conditions_met === null
                      ? "Not evaluated"
                      : run.conditions_met
                        ? "Conditions met"
                        : "Conditions not met"}
                    {run.error ? ` — ${run.error}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    tone={
                      run.status === "succeeded"
                        ? "lime"
                        : run.status === "failed"
                          ? "red"
                          : "neutral"
                    }
                  >
                    {run.status}
                  </Badge>
                  <span className="font-mono text-[10.5px] text-ink/40">
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
