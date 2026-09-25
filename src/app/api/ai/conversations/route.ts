import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { listConversations } from "@/server/services/ai";

export const GET = withRoute("GET /api/ai/conversations", async () => {
  const auth = await requireAuthContext();
  return json({ conversations: await listConversations(auth.workspaceId, auth.user.id) });
});
