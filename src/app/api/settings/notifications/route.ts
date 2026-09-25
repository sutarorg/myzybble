import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getNotificationPrefs, updateNotificationPrefs } from "@/server/services/settings";

const prefsSchema = z.object({
  searchCompleted: z.boolean(),
  searchFailed: z.boolean(),
  subscriptionChanged: z.boolean(),
  paymentFailed: z.boolean(),
  campaignCompleted: z.boolean(),
  usageThreshold: z.boolean(),
  securityAlerts: z.boolean(),
  productUpdates: z.boolean(),
});

export const GET = withRoute("GET /api/settings/notifications", async () => {
  const auth = await requireAuthContext();
  return json({ preferences: await getNotificationPrefs(auth.user.id) });
});

export const PATCH = withRoute(
  "PATCH /api/settings/notifications",
  async (request: NextRequest) => {
    const auth = await requireAuthContext();
    const input = await readJson(request, prefsSchema.partial());
    const preferences = await updateNotificationPrefs(auth.user.id, input);
    return json({ preferences });
  },
);
