import { NextRequest } from "next/server";
import { withRoute, json, readJson } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { runChat, isAiConfigured } from "@/server/services/ai";
import { Errors } from "@/lib/errors";
import { aiChatSchema } from "@/lib/validation";

/**
 * AI Assistant chat (§20).
 *
 * The Gemini key is server-only and the model never sees a credential. Tools
 * run inside `runChat` with the caller's workspace already resolved from their
 * session, so the model can't reach another tenant's data even if it asks.
 */
export const POST = withRoute("POST /api/ai/chat", async (request: NextRequest) => {
  const auth = await requireAuthContext();

  if (!isAiConfigured()) {
    throw Errors.dependency(
      "The AI Assistant isn't configured on this deployment. Set GEMINI_API_KEY to enable it.",
    );
  }
  await requireRateLimit("ai:chat", `${auth.workspaceId}:${auth.user.id}`);

  const input = await readJson(request, aiChatSchema);
  const result = await runChat({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    conversationId: input.conversationId,
    message: input.message,
    context: input.context,
  });

  return json(result);
});
