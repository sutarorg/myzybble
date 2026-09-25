import { requireAuthContext } from "@/server/auth";
import { getEntitlements } from "@/server/services/usage";
import { listJobs } from "@/server/services/searches";
import { publicEnv } from "@/lib/env";
import NewSearchForm from "@/features/searches/NewSearchForm";
import { SectionTitle, Card, LinkButton, StatusBadge } from "@/components/app/primitives";

export const metadata = { title: "Find leads" };

export default async function FindLeadsPage() {
  const ctx = await requireAuthContext();
  const [quota, jobs] = await Promise.all([
    getEntitlements(ctx.workspaceId),
    listJobs(ctx.workspaceId, 3),
  ]);

  const activeJob = jobs.find((j) =>
    ["queued", "starting", "running", "paused", "cancelling"].includes(j.status),
  );

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        sub="Search Google Maps by keyword and location. zybble extracts businesses, enriches contacts and saves unique leads to your workspace."
      >
        Find leads
      </SectionTitle>

      {activeJob && (
        <Card className="mb-6 border-lime/30 bg-lime/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">Search in progress</p>
              <p className="mt-1 font-display text-lg font-bold">
                {activeJob.keywords.join(", ")} · {activeJob.locations.join(", ")}
              </p>
              <p className="mt-1 text-sm text-ink/60">
                {activeJob.unique_results.toLocaleString()} of {activeJob.requested_limit.toLocaleString()} leads
                collected so far.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={activeJob.status} />
              <LinkButton href={`/searches/${activeJob.search_id ?? activeJob.id}`} variant="ink" size="sm">
                Watch progress
              </LinkButton>
            </div>
          </div>
        </Card>
      )}

      <NewSearchForm
        leadsRemaining={quota.leadsRemaining}
        monthlyLeads={quota.monthlyLeads}
        planName={quota.planName}
        devMode={publicEnv.devMode}
      />
    </div>
  );
}
