import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { confirmPendingAction } from "@/server/services/ai";

/**
 * Confirms an expensive action the assistant proposed (starting a search,
 * creating a campaign…). The assistant can *propose*; only a signed-in user
 * click can execute it (§20).
 */
/**
 * The client echoes back the exact `PendingAction` the assistant proposed. Its
 * `id` is also the idempotency key, so a double-click can't run it twice.
 */
const schema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(["create_search", "create_campaign", "create_list", "add_to_list"]),
  label: z.string().max(300).default("Confirm action"),
  reason: z.string().max(1_000).default(""),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const POST = withRoute("POST /api/ai/confirm", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("ai:chat", `${auth.workspaceId}:${auth.user.id}`);

  const action = await readJson(request, schema);
  const result = await confirmPendingAction({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    action,
  });

  return json({ ...result, actionId: action.id, requestId: ctx.requestId });
});
