import { withRoute, json } from "@/server/api";
import { listPlans } from "@/server/services/usage";

/**
 * Public plan catalogue. Prices, quotas and feature flags are read straight
 * from the `plans` table — the server is the only authority on what a plan
 * costs and includes (§10).
 */
export const GET = withRoute("GET /api/plans", async () => {
  const plans = await listPlans();
  return json({
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      priceCents: Number(p.price_cents),
      currency: p.currency,
      interval: p.interval,
      monthlyLeads: Number(p.monthly_leads),
      features: p.features,
    })),
  });
});
