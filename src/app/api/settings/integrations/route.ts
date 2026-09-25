import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { serverEnv } from "@/lib/env";
import { integrationStatus } from "@/server/services/settings";

/**
 * Reports *capability* only — whether the deployment has each provider
 * configured. It never returns a key, secret or endpoint credential (§27).
 */
export const GET = withRoute("GET /api/settings/integrations", async () => {
  const auth = await requireAuthContext();
  return json({
    integrations: await integrationStatus(auth.workspaceId),
    // Echoed so the UI can explain what's missing without guessing.
    requiredEnv: {
      supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      razorpay: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
      resend: ["RESEND_API_KEY", "EMAIL_FROM"],
      gemini: ["GEMINI_API_KEY"],
      worker: ["WORKER_BASE_URL", "WORKER_SHARED_SECRET"],
    },
    environment: serverEnv.NODE_ENV,
  });
});
