import { requireAuthContext } from "@/server/auth";
import { getSubscription, listBillingEvents } from "@/server/services/billing";
import { listPlans, getEntitlements } from "@/server/services/usage";
import { SectionTitle, Card, StatCard, Badge, ProgressBar, StatusBadge } from "@/components/app/primitives";
import PlanSelector from "@/features/billing/PlanSelector";
import ManageSubscription from "@/features/billing/ManageSubscription";
import { CreditCard, Gauge, CalendarClock, Receipt } from "lucide-react";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const ctx = await requireAuthContext();
  const [plans, subscription, events, snapshot] = await Promise.all([
    listPlans(),
    getSubscription(ctx.workspaceId),
    listBillingEvents(ctx.workspaceId, 25),
    getEntitlements(ctx.workspaceId),
  ]);

  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const usedPct =
    snapshot.monthlyLeads > 0
      ? Math.min(100, Math.round((snapshot.leadsUsed / snapshot.monthlyLeads) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SectionTitle sub="Plans, usage and payment history. Prices and quotas come from the server — never the browser.">
        Billing
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Plan" value={snapshot.planName} icon={CreditCard} />
        <StatCard
          label="Leads used this period"
          value={`${snapshot.leadsUsed.toLocaleString()} / ${snapshot.monthlyLeads.toLocaleString()}`}
          icon={Gauge}
        />
        <StatCard label="Remaining" value={snapshot.leadsRemaining.toLocaleString()} icon={Receipt} />
        <StatCard
          label={subscription?.cancel_at_period_end ? "Access ends" : "Renews"}
          value={
            snapshot.periodEnd
              ? new Date(snapshot.periodEnd).toLocaleDateString()
              : "—"
          }
          icon={CalendarClock}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Usage this period</h2>
            <p className="mt-0.5 text-sm text-ink/50">
              A billable lead is a <strong>unique</strong> lead successfully saved. Duplicates are
              never counted or charged.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={snapshot.status} />
            {subscription?.cancel_at_period_end && <Badge tone="amber">cancels at period end</Badge>}
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={snapshot.leadsUsed} max={snapshot.monthlyLeads} />
          <p className="mt-2 font-mono text-[11px] text-ink/45">
            {snapshot.leadsUsed.toLocaleString()} of {snapshot.monthlyLeads.toLocaleString()} ·{" "}
            {usedPct}%
          </p>
        </div>
      </Card>

      <div>
        <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Plans</h2>
        <PlanSelector
          plans={plans.map((p) => ({
            code: p.code,
            name: p.name,
            priceCents: Number(p.price_cents),
            currency: p.currency,
            monthlyLeads: Number(p.monthly_leads),
            current: p.code === snapshot.planCode,
          }))}
        />
        <p className="mt-4 text-xs text-ink/45">
          Every plan includes email data, phone data, CSV export, the AI Assistant and Campaigns.
          Prices are in USD and billed monthly. Cancelling keeps access until the end of the period.
        </p>
      </div>

      {subscription && <ManageSubscription subscriptionId={subscription.id} status={subscription.status} cancelAtPeriodEnd={subscription.cancel_at_period_end} />}

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Billing history</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">
            No billing events yet. Payments, renewals and plan changes appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/8">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-ink/70">{event.event_type}</p>
                  {event.error && <p className="truncate text-xs text-red-600">{event.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!event.signature_valid && <Badge tone="red">bad signature</Badge>}
                  <Badge tone={event.status === "processed" ? "lime" : "neutral"}>{event.status}</Badge>
                  <span className="font-mono text-[10.5px] text-ink/40">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {subscription?.last_payment_at && (
        <p className="font-mono text-[11px] text-ink/40">
          Last payment {new Date(subscription.last_payment_at).toLocaleString()} (
          {subscription.last_payment_status ?? "unknown"}) · customer{" "}
          {subscription.razorpay_customer_id ?? "—"}
        </p>
      )}
      <p className="sr-only">{money(0)}</p>
    </div>
  );
}
