"use client";

/**
 * AI Assistant chat.
 *
 * The model can query the workspace through server-side tools, and expensive
 * actions come back as `pendingActions` that render as an explicit
 * "Run this?" button. The assistant never silently spends quota or sends mail —
 * and it never invents business data: tool results are labelled as stored data
 * and the model's own words are labelled separately (§20).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Badge } from "@/components/app/primitives";
import { Send, Loader2, Sparkles, Database, PenLine, AlertTriangle } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
  pendingActions?: PendingAction[];
  error?: string;
}

export interface PendingAction {
  id: string;
  type: "create_search" | "create_list" | "create_campaign" | "add_to_list";
  label: string;
  reason: string;
  params: Record<string, unknown>;
}

const SUGGESTIONS = [
  "Which dentists in Berlin have a verified email but no website?",
  "Summarise the leads from my last search",
  "Draft a cold opener for plumbing companies in Austin",
  "How much of my quota have I used this month?",
];

const TOOL_LABELS: Record<string, string> = {
  search_leads: "Searched your leads",
  get_lead: "Looked up a lead",
  get_list: "Looked up a list",
  filter_leads: "Filtered your leads",
  create_search: "Prepared a new search",
  create_list: "Prepared a new list",
  create_campaign: "Prepared a campaign",
  get_usage: "Checked your usage",
  get_subscription: "Checked your subscription",
};

export default function AssistantChat({
  conversationId: initialConversationId,
  context,
}: {
  conversationId?: string;
  context?: { leadId?: string; listId?: string; searchId?: string };
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Double-click guard for pending-action buttons. State rather than a ref:
  // the buttons read it during render, and refs must not be read there.
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  // Monotonic client-side id source for optimistic user messages.
  const localId = useRef(0);

  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/ai/conversations/${initialConversationId}`);
      if (!res.ok || cancelled) return;
      const body = await res.json().catch(() => ({}));
      const loaded = (body.messages ?? []) as {
        id: string;
        role: string;
        content: string;
        tool_calls: unknown;
      }[];
      if (cancelled) return;
      setMessages(
        loaded
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [initialConversationId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setError(null);

    const userMessage: ChatMessage = {
      id: `u-${++localId.current}`,
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMessage]);

    start(async () => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message, context: context ?? {} }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body?.error?.message ?? "The assistant couldn't respond. Try again.");
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        return;
      }

      setConversationId(body.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: body.reply ?? "",
          toolCalls: body.toolCalls ?? [],
          pendingActions: body.pendingActions ?? [],
        },
      ]);
      router.refresh();
    });
  }

  function confirmAction(action: PendingAction) {
    if (confirmed.has(action.id)) return;
    setConfirmed((prev) => new Set(prev).add(action.id));
    start(async () => {
      const res = await fetch("/api/ai/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "That action couldn't be completed.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "assistant",
          content: `Done — ${action.label}. ${
            body.result?.jobId ? "Your search is running." : ""
          }`,
        },
      ]);
      router.refresh();
    });
  }

  return (
    <Card className="flex h-[calc(100vh-13rem)] flex-col !p-0">
      <div ref={scrollerRef} className="flex-1 space-y-5 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-lime">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold tracking-tight">
              Ask about your leads
            </h2>
            <p className="mt-1.5 text-sm text-ink/55">
              The assistant can search, filter and summarise the data in your workspace. It flags
              anything it infers, and asks before it spends quota or sends anything.
            </p>
            <div className="mt-5 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-ink/10 bg-white/60 px-4 py-2.5 text-left text-sm text-ink/70 transition-colors hover:border-ink/25 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {message.role === "user" ? (
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-paper">
                  {message.content}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {message.toolCalls.map((call, i) => (
                      <Badge key={`${call.name}-${i}`} tone="neutral">
                        <Database className="mr-1 h-3 w-3" />
                        {TOOL_LABELS[call.name] ?? call.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl rounded-bl-md border border-ink/10 bg-white/70 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">
                    {message.content}
                  </p>
                </div>

                {message.pendingActions && message.pendingActions.length > 0 && (
                  <div className="space-y-2">
                    {message.pendingActions.map((action) => (
                      <div
                        key={action.id}
                        className="rounded-2xl border border-lime/50 bg-lime/12 p-4"
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink/60" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{action.label}</p>
                            {action.reason && (
                              <p className="mt-0.5 text-xs text-ink/55">{action.reason}</p>
                            )}
                          </div>
                          <Button
                            variant="lime"
                            disabled={pending || confirmed.has(action.id)}
                            onClick={() => confirmAction(action)}
                          >
                            {confirmed.has(action.id) ? "Running…" : "Run it"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-ink/45">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="border-t border-red-500/20 bg-red-500/5 px-5 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-ink/10 p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Ask about your leads… (Enter to send, Shift+Enter for a new line)"
          className="max-h-40 flex-1 resize-none rounded-xl border border-ink/15 bg-white/70 px-4 py-3 text-sm outline-none transition-colors placeholder:text-ink/35 focus:border-ink/40 focus:ring-4 focus:ring-lime/30"
        />
        <Button type="submit" variant="lime" disabled={pending || input.trim().length === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      <p className="border-t border-ink/8 px-4 py-2 font-mono text-[10px] text-ink/35">
        <PenLine className="mr-1 inline h-3 w-3" />
        Answers marked with a tool badge come from your stored data. Everything else is the
        model&apos;s analysis or copy — not a fact about a business.
      </p>
    </Card>
  );
}
