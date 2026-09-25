import { requireAuthContext } from "@/server/auth";
import { listLeads, leadFacets } from "@/server/services/leads";
import { listLists } from "@/server/services/lists";
import { getEntitlements } from "@/server/services/usage";
import LeadsTable from "@/features/leads/LeadsTable";
import { SectionTitle, LinkButton } from "@/components/app/primitives";
import { Plus } from "lucide-react";

export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAuthContext();
  const sp = await searchParams;

  const first = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const [page, facets, lists, quota] = await Promise.all([
    listLeads(ctx.workspaceId, {
      q: first("q") || undefined,
      limit: 50,
    }),
    leadFacets(ctx.workspaceId),
    listLists(ctx.workspaceId),
    getEntitlements(ctx.workspaceId),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle sub="Filter, tag and export every business in this workspace.">
          Leads
          <span className="ml-2 font-mono text-base font-medium text-ink/40">
            {page.total !== null ? page.total.toLocaleString() : ""}
          </span>
        </SectionTitle>
        <div className="flex gap-2.5">
          <LinkButton href="/lists" variant="outline">
            Manage lists
          </LinkButton>
          <LinkButton href="/find-leads" variant="lime">
            <Plus className="h-4 w-4" />
            Find leads
          </LinkButton>
        </div>
      </div>

      {quota.leadsRemaining <= 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You&apos;ve used this month&apos;s lead allowance. Upgrade to keep adding leads.
        </p>
      )}

      <LeadsTable
        initialLeads={page.leads}
        initialTotal={page.total}
        initialNextCursor={page.nextCursor}
        cities={facets.cities}
        categories={facets.categories}
        lists={lists.map((l) => ({ id: l.id, name: l.name }))}
        leadsRemaining={quota.leadsRemaining}
      />
    </div>
  );
}
