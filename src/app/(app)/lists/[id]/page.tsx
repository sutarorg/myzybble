import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthContext } from "@/server/auth";
import { getList, listListLeadIds } from "@/server/services/lists";
import { listLeads } from "@/server/services/leads";
import ListMembers from "@/features/lists/ListMembers";
import { Badge, LinkButton } from "@/components/app/primitives";
import { Pencil, Trash2 } from "lucide-react";
import ListActions from "@/features/lists/ListActions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext().catch(() => null);
  if (!ctx) return { title: "List" };
  const list = await getList(ctx.workspaceId, id);
  return { title: list?.name ?? "List" };
}

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const list = await getList(ctx.workspaceId, id);
  if (!list) notFound();

  const memberIds = await listListLeadIds(ctx.workspaceId, id);
  const page = await listLeads(ctx.workspaceId, { listId: id, limit: 100, sort: "recent", direction: "desc" });

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/lists"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-ink/50 transition-colors hover:text-ink"
      >
        ← Back to lists
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">{list.name}</h1>
            {list.archived_at && <Badge tone="amber">archived</Badge>}
          </div>
          {list.description && <p className="mt-1.5 max-w-2xl text-sm text-ink/55">{list.description}</p>}
          <p className="mt-2 font-mono text-[11px] text-ink/45">
            {memberIds.length.toLocaleString()} lead{memberIds.length === 1 ? "" : "s"} · created{" "}
            {new Date(list.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2.5">
          <LinkButton href="/leads" variant="outline">
            Add leads
          </LinkButton>
          <ListActions list={list} />
        </div>
      </div>

      <ListMembers listId={list.id} leads={page.leads} />
    </div>
  );
}
