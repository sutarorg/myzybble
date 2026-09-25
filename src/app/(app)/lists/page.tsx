import Link from "next/link";
import { requireAuthContext } from "@/server/auth";
import { listLists } from "@/server/services/lists";
import { SectionTitle, Card, EmptyState, Badge, LinkButton } from "@/components/app/primitives";
import { FolderOpen, Plus, ArrowRight } from "lucide-react";
import CreateListButton from "@/features/lists/CreateListButton";

export const metadata = { title: "Lists" };

export default async function ListsPage() {
  const ctx = await requireAuthContext();
  const lists = await listLists(ctx.workspaceId);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle sub="Group leads into reusable segments for campaigns and exports.">Lists</SectionTitle>
        <CreateListButton />
      </div>

      {lists.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No lists yet"
          body="Create a list to group leads you want to export, enrich or run a campaign against."
          action={<CreateListButton variant="lime" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="group rounded-2xl border border-ink/10 bg-white/70 p-5 transition-all hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_20px_50px_-24px_rgba(11,16,14,0.28)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-bold tracking-tight">{list.name}</h3>
                  {list.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink/55">{list.description}</p>
                  )}
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-lime transition-transform group-hover:-rotate-6">
                  <FolderOpen className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-ink/8 pt-4">
                <span className="font-mono text-[11px] text-ink/45">
                  {list.member_count.toLocaleString()} lead{list.member_count === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink/50 group-hover:text-ink">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              {list.archived_at && (
                <div className="mt-3">
                  <Badge tone="amber">archived</Badge>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
