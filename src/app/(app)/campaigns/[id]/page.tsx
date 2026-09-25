import { notFound } from "next/navigation";
import { requireAuthContext } from "@/server/auth";
import {
  getCampaign,
  getCampaignSteps,
  listCampaignActivity,
  listCampaignLeads,
} from "@/server/services/campaigns";
import { listLeads } from "@/server/services/leads";
import { SectionTitle, Card, StatCard, StatusBadge, Badge } from "@/components/app/primitives";
import CampaignBuilder from "@/features/campaigns/CampaignBuilder";
import CampaignLeads from "@/features/campaigns/CampaignLeads";
import CampaignControls from "@/features/campaigns/CampaignControls";
import { Send, Users, MessageSquare, AlertTriangle, MailCheck } from "lucide-react";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const campaign = await getCampaign(ctx.workspaceId, id);
  if (!campaign) notFound();

  const [steps, activity, recipients, leadsPage] = await Promise.all([
    getCampaignSteps(ctx.workspaceId, id),
    listCampaignActivity(ctx.workspaceId, id),
    listCampaignLeads(ctx.workspaceId, id, 500),
    listLeads(ctx.workspaceId, { limit: 500 }),
  ]);

  const stats = (campaign.stats ?? {}) as Record<string, number>;
  const terminal = campaign.status === "completed" || campaign.status === "cancelled";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-3xl font-bold tracking-[-0.02em]">
              {campaign.name}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="mt-1.5 max-w-2xl text-sm text-ink/55">{campaign.description}</p>
          )}
          <p className="mt-2 font-mono text-[11px] text-ink/40">
            created {new Date(campaign.created_at).toLocaleString()} · {campaign.timezone ?? "UTC"}
          </p>
        </div>
        <CampaignControls
          campaignId={campaign.id}
          status={campaign.status}
          recipients={Number(stats.recipients ?? recipients.length ?? 0)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Recipients"
          value={Number(stats.recipients ?? recipients.length ?? 0)}
          icon={Users}
        />
        <StatCard label="Sent" value={Number(stats.sent ?? 0)} icon={Send} />
        <StatCard label="Replies" value={Number(stats.replied ?? 0)} icon={MessageSquare} />
        <StatCard
          label="Bounced / failed"
          value={Number(stats.bounced ?? 0) + Number(stats.failed ?? 0)}
          icon={AlertTriangle}
        />
      </div>

      {!campaign.mailbox_id && (
        <Card>
          <div className="flex items-start gap-3">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-semibold">No sending mailbox attached</h2>
              <p className="mt-1 text-sm text-ink/60">
                This campaign won&apos;t send until you attach a verified mailbox. Add one in{" "}
                <a href="/mailboxes" className="font-semibold underline underline-offset-2">
                  Mailboxes
                </a>
                , then pick it here.
              </p>
            </div>
          </div>
        </Card>
      )}

      <CampaignBuilder
        campaignId={campaign.id}
        initialSteps={steps.map((s) => ({
          id: s.id,
          kind: s.kind,
          subject: s.subject ?? "",
          body: s.body ?? "",
          delayMinutes: Number(s.delay_minutes),
          conditions: (s.conditions ?? {}) as Record<string, unknown>,
        }))}
        dailyLimit={Number(campaign.daily_limit)}
        stopOnReply={campaign.stop_on_reply}
        timezone={campaign.timezone ?? "UTC"}
      />

      <div>
        <SectionTitle sub="Enrol leads, then watch each recipient move through the sequence.">
          Recipients
        </SectionTitle>
        <CampaignLeads
          campaignId={campaign.id}
          readOnly={terminal}
          available={(leadsPage.leads ?? []).map((lead) => ({
            id: lead.id,
            businessName: lead.business_name,
            email: lead.primary_email,
            city: lead.city,
            emailStatus: lead.email_status,
          }))}
          recipients={activity.map((a) => ({
            id: a.id,
            email: a.email,
            status: a.status,
            currentStep: a.currentStep,
            attempts: a.attempts,
            lastError: a.lastError,
            sentAt: a.sentAt,
            repliedAt: a.repliedAt,
            bouncedAt: a.bouncedAt,
            failedAt: a.failedAt,
            leadId: a.leadId,
            businessName: a.businessName,
          }))}
        />
      </div>

      {activity.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-bold tracking-tight">Recent activity</h2>
          <ul className="mt-4 divide-y divide-ink/8">
            {activity.slice(0, 25).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {a.businessName ?? a.email}
                  </p>
                  <p className="truncate font-mono text-[11px] text-ink/45">{a.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.lastError && <Badge tone="red">error</Badge>}
                  <StatusBadge status={a.status} />
                  <span className="font-mono text-[10.5px] text-ink/40">
                    {a.sentAt ? new Date(a.sentAt).toLocaleDateString() : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
