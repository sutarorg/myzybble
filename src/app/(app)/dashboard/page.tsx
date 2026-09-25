import Link from "next/link";
import { Suspense } from "react";
import {
  Database,
  CalendarPlus,
  MailCheck,
  Crosshair,
  TrendingUp,
  ArrowRight,
  MapPin,
  Star,
} from "lucide-react";
import { requireAuthContext } from "@/server/auth";
import { workspaceStats } from "@/server/services/leads";
import { listSearches } from "@/server/services/searches";
import { listCampaigns } from "@/server/services/campaigns";
import { getEntitlements } from "@/server/services/usage";
import { listLeads } from "@/server/services/leads";
import { StatCard, Card, CardHeader, EmptyState, StatusBadge, ProgressBar, LinkButton, Badge } from "@/components/app/primitives";
import { cn } from "@/lib/cn";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireAuthContext();

  const [stats, searches, campaigns, leads, quota] = await Promise.all([
    workspaceStats(ctx.workspaceId),
    listSearches(ctx.workspaceId, { limit: 5 }),
    listCampaigns(ctx.workspaceId),
    listLeads(ctx.workspaceId, { sort: "recent", direction: "desc", limit: 6 }),
    getEntitlements(ctx.workspaceId),
  ]);

  const activeSearches = searches.searches.filter((s) =>
    ["queued", "starting", "running", "paused", "cancelling"].includes(s.status),
  );
  const completedSearches = searches.searches.filter((s) => s.status === "completed");
  const firstName = ctx.profile.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-7xl">
      {/* header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/45">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-[-0.02em]">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-ink/55">
            {stats.totalLeads === 0
              ? "Run your first search to start building a pipeline."
              : `${stats.totalLeads.toLocaleString()} leads in your workspace. ${stats.leadsThisMonth.toLocaleString()} added this month.`}
          </p>
        </div>
        <LinkButton href="/find-leads" variant="lime">
          <Crosshair className="h-4 w-4" />
          Find leads
        </LinkButton>
      </div>

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total leads"
          value={stats.totalLeads.toLocaleString()}
          sub={`${stats.leadsThisMonth.toLocaleString()} this month`}
          icon={Database}
          href="/leads"
        />
        <StatCard
          label="Verified emails"
          value={stats.verifiedEmails.toLocaleString()}
          sub={`${pct(stats.verifiedEmails, stats.totalLeads)}% of leads`}
          icon={MailCheck}
          href="/leads?hasEmail=true"
        />
        <StatCard
          label="Active searches"
          value={activeSearches.length.toLocaleString()}
          sub={`${completedSearches.length} completed recently`}
          icon={Crosshair}
          href="/searches"
        />
        <StatCard
          label="Current plan"
          value={quota.planName}
          sub={`${quota.leadsRemaining.toLocaleString()} leads remaining`}
          icon={TrendingUp}
          href="/billing"
          tone="dark"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* usage */}
        <Card className="lg:col-span-1">
          <CardHeader title="Monthly usage" sub={`Resets ${quota.periodEnd ? new Date(quota.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "next month"}`} />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-tight">
              {quota.leadsUsed.toLocaleString()}
            </span>
            <span className="font-mono text-xs text-ink/50">/ {quota.monthlyLeads.toLocaleString()} leads</span>
          </div>
          <ProgressBar
            className="mt-4"
            value={quota.leadsUsed}
            max={quota.monthlyLeads}
          />
          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/45">Plan</p>
              <p className="text-sm font-semibold">{quota.planName}</p>
            </div>
            <Link href="/billing" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              Manage
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          {quota.leadsUsed / Math.max(quota.monthlyLeads, 1) >= 0.8 && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              You&apos;ve used {Math.round((quota.leadsUsed / Math.max(quota.monthlyLeads, 1)) * 100)}% of this
              month&apos;s allowance.
            </p>
          )}
        </Card>

        {/* recent searches */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent searches"
            sub="Live status from the scraping worker"
            action={
              <Link href="/searches" className="text-sm font-semibold text-ink/60 hover:text-ink">
                View all
              </Link>
            }
          />
          {searches.searches.length === 0 ? (
            <EmptyState
              icon={Crosshair}
              title="No searches yet"
              body="Pick a keyword and a city, and zybble will extract verified businesses from Google Maps."
              action={
                <LinkButton href="/find-leads" variant="lime">
                  Run your first search
                </LinkButton>
              }
            />
          ) : (
            <ul className="divide-y divide-ink/8">
              {searches.searches.map((search) => (
                <li key={search.id}>
                  <Link
                    href={`/searches/${search.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-ink/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{search.name ?? "Untitled search"}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-ink/45">
                        <MapPin className="h-3 w-3" />
                        {search.locations.slice(0, 2).join(", ") || "—"}
                        <span className="text-ink/25">·</span>
                        {new Date(search.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden font-mono text-xs text-ink/60 sm:block">
                        {search.result_count.toLocaleString()} leads
                      </span>
                      <StatusBadge status={search.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* recent leads */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent leads"
            sub="Newest businesses added to this workspace"
            action={
              <Link href="/leads" className="text-sm font-semibold text-ink/60 hover:text-ink">
                View all
              </Link>
            }
          />
          {leads.leads.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No leads yet"
              body="Leads appear here as soon as a search finishes processing."
              action={
                <LinkButton href="/find-leads" variant="outline">
                  Find leads
                </LinkButton>
              }
            />
          ) : (
            <ul className="divide-y divide-ink/8">
              {leads.leads.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-ink/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold">
                        {lead.business_name}
                        {lead.is_dev_data && <Badge tone="amber">dev</Badge>}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink/45">
                        {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-ink/55">
                      {lead.rating !== null && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {lead.rating}
                        </span>
                      )}
                      <span className={cn("hidden sm:block", lead.primary_email ? "text-forest" : "text-ink/30")}>
                        {lead.primary_email ? "email" : "no email"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* campaigns */}
        <Card>
          <CardHeader
            title="Campaigns"
            sub="Outreach sequences"
            action={
              <Link href="/campaigns" className="text-sm font-semibold text-ink/60 hover:text-ink">
                View all
              </Link>
            }
          />
          {campaigns.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="No campaigns"
              body="Group your best leads into a list and launch a multi-step sequence."
              action={
                <LinkButton href="/campaigns" variant="outline">
                  Create campaign
                </LinkButton>
              }
            />
          ) : (
            <ul className="divide-y divide-ink/8">
              {campaigns.slice(0, 5).map((campaign) => {
                const stats = (campaign.stats ?? {}) as { recipients?: number; sent?: number; replied?: number };
                return (
                  <li key={campaign.id}>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-ink/[0.02]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{campaign.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink/45">
                          {stats.sent ?? 0} sent · {stats.replied ?? 0} replies
                        </p>
                      </div>
                      <StatusBadge status={campaign.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
