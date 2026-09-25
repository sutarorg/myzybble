import { requireAuthContext } from "@/server/auth";
import { listConversations, isAiConfigured, aiUsageSummary } from "@/server/services/ai";
import { SectionTitle, Card } from "@/components/app/primitives";
import AssistantChat from "@/features/ai/AssistantChat";
import Link from "next/link";

export const metadata = { title: "AI Assistant" };

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; lead?: string; list?: string; search?: string }>;
}) {
  const ctx = await requireAuthContext();
  const params = await searchParams;
  const [conversations, usage] = await Promise.all([
    listConversations(ctx.workspaceId, ctx.user.id),
    aiUsageSummary(ctx.workspaceId),
  ]);

  const context = {
    ...(params.lead ? { leadId: params.lead } : {}),
    ...(params.list ? { listId: params.list } : {}),
    ...(params.search ? { searchId: params.search } : {}),
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_260px]">
      <div>
        <SectionTitle sub="Ask questions about your leads in plain English. It can search, filter and draft — and asks before spending quota.">
          AI Assistant
        </SectionTitle>

        {!isAiConfigured() && (
          <Card className="mb-5">
            <p className="text-sm text-ink/70">
              The AI Assistant isn&apos;t configured on this deployment. Add{" "}
              <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs">GEMINI_API_KEY</code>{" "}
              to enable it — see{" "}
              <Link href="/settings/integrations" className="font-semibold underline underline-offset-2">
                Settings → Integrations
              </Link>
              .
            </p>
          </Card>
        )}

        <AssistantChat conversationId={params.c} context={context} />
      </div>

      <aside className="space-y-4">
        <Card>
          <h2 className="font-display text-base font-bold tracking-tight">Usage</h2>
          <dl className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink/55">Assistant replies</dt>
              <dd className="font-mono text-sm">
                {Number(usage?.assistantMessages ?? 0).toLocaleString()}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold tracking-tight">Conversations</h2>
            <Link
              href="/ai"
              className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/40 hover:text-ink"
            >
              new
            </Link>
          </div>
          {conversations.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">No saved conversations yet.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/ai?c=${conversation.id}`}
                    className={`block truncate rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-ink/5 ${
                      params.c === conversation.id ? "bg-ink/5 font-medium" : "text-ink/70"
                    }`}
                  >
                    {conversation.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
