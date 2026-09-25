import { notFound } from "next/navigation";
import { requireAuthContext } from "@/server/auth";
import { listMailboxes } from "@/server/services/campaigns";
import { listCampaigns } from "@/server/services/campaigns";
import { SectionTitle, Card, StatCard, StatusBadge, Badge } from "@/components/app/primitives";
import { Mailbox as MailboxIcon, Send, Megaphone, CalendarDays } from "lucide-react";
import Link from "next/link";

/**
 * Mailbox detail. The row is re-fetched through `listMailboxes` (which strips
 * secrets) rather than a raw select, so this page structurally cannot render an
 * SMTP password even if the schema gains one.
 */
export default async function MailboxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const mailboxes = await listMailboxes(ctx.workspaceId);
  const mailbox = mailboxes.find((m) => m.id === id);
  if (!mailbox) notFound();

  const campaigns = await listCampaigns(ctx.workspaceId);
  const using = campaigns.filter((c) => c.mailbox_id === id);
  const remaining = Math.max(0, mailbox.dailySendLimit - mailbox.sentToday);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-3xl font-bold tracking-[-0.02em]">
              {mailbox.name}
            </h1>
            <StatusBadge status={mailbox.status} />
          </div>
          <p className="mt-1.5 font-mono text-sm text-ink/55">{mailbox.email}</p>
          <p className="mt-1 font-mono text-[11px] text-ink/40">
            added {new Date(mailbox.createdAt).toLocaleDateString()}
            {mailbox.verifiedAt
              ? ` · verified ${new Date(mailbox.verifiedAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <Link
          href="/mailboxes"
          className="text-sm font-medium text-ink/55 underline decoration-lime decoration-2 underline-offset-4 hover:text-ink"
        >
          All mailboxes
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sent today" value={mailbox.sentToday} icon={Send} />
        <StatCard label="Remaining today" value={remaining} icon={CalendarDays} />
        <StatCard label="Daily limit" value={mailbox.dailySendLimit} icon={MailboxIcon} />
        <StatCard label="Campaigns" value={using.length} icon={Megaphone} />
      </div>

      {mailbox.lastError && (
        <Card>
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
            {mailbox.lastError}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Configuration</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["Provider", mailbox.provider],
            ["SMTP host", mailbox.smtpHost ?? "—"],
            ["SMTP port", mailbox.smtpPort ? String(mailbox.smtpPort) : "—"],
            ["SMTP username", mailbox.smtpUsername ?? "—"],
            ["SMTP password", mailbox.hasSmtpPassword ? "stored encrypted" : "not set"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
                {label}
              </dt>
              <dd className="mt-0.5 font-mono text-sm text-ink/75">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Campaigns using this mailbox</h2>
        {using.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">
            No campaign is using this mailbox yet.{" "}
            <Link href="/campaigns" className="font-semibold underline underline-offset-2">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/8">
            {using.map((campaign) => (
              <li key={campaign.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {campaign.name}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="neutral">
                    {String(
                      ((campaign.stats ?? {}) as Record<string, number>).sent ?? 0,
                    )}{" "}
                    sent
                  </Badge>
                  <StatusBadge status={campaign.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
