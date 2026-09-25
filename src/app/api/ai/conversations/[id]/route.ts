import { withRoute, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { getConversation } from "@/server/services/ai";

export const GET = withRoute("GET /api/ai/conversations/[id]", async (_request, ctx) => {
  const auth = await requireAuthContext();
  const conversation = await getConversation(auth.workspaceId, auth.user.id, ctx.params.id);
  if (!conversation) {
    return json({ error: { code: "not_found", message: "Conversation not found." } }, 404);
  }
  return json(conversation);
});
