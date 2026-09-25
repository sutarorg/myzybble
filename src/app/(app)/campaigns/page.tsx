import Link from "next/link";
import { requireAuthContext } from "@/server/auth";
import { listCampaigns } from "@/server/services/campaigns";
import { listMailboxes } from "@/server/services/campaigns";
import { SectionTitle, EmptyState, StatusBadge } from "@/components/app/primitives";
import CreateCampaignButton from "@/features/campaigns/CreateCampaignButton";
import { Megaphone, ArrowRight } from "lucide-react";

export const metadata = { title: "Campaigns" };

function statsOf(stats: unknown): Record<string, number> {
  return (stats ?? {}) as Record<string, number>;
}

export default async function CampaignsPage() {
  const ctx = await requireAuthContext();
  const [campaigns, mailboxes] = await Promise.all([
    listCampaigns(ctx.workspaceId),
    listMailboxes(ctx.workspaceId),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle sub="Multi-step email sequences, sent server-side with suppression and rate limits.">
          Campaigns
        </SectionTitle>
        <CreateCampaignButton
          mailboxes={mailboxes.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            status: m.status,
          }))}
        />
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          body="Build a sequence — an opener, a wait, a follow-up — then enrol leads from your workspace."
          action={
            <CreateCampaignButton
              variant="lime"
              mailboxes={mailboxes.map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                status: m.status,
              }))}
            />
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const stats = statsOf(campaign.stats);
            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="group rounded-2xl border border-ink/10 bg-white/70 p-5 transition-all hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_20px_50px_-24px_rgba(11,16,14,0.28)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-bold tracking-tight">
                      {campaign.name}
                    </h3>
                    {campaign.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink/55">
                        {campaign.description}
                      </p>
                    )}
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-lime transition-transform group-hover:-rotate-6">
                    <Megaphone className="h-4.5 w-4.5" />
                  </span>
                </div>

                <div className="mt-4">
                  <StatusBadge status={campaign.status} />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-ink/8 pt-4">
                  {[
                    ["recipients", stats.recipients ?? 0],
                    ["sent", stats.sent ?? 0],
                    ["replied", stats.replied ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">
                        {label}
                      </dt>
                      <dd className="font-display text-lg font-bold">
                        {Number(value).toLocaleString()}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-ink/40">
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink/50 group-hover:text-ink">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
