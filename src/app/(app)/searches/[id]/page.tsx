import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthContext } from "@/server/auth";
import { getSearch, getJob } from "@/server/services/searches";
import JobProgressPanel from "@/features/searches/JobProgressPanel";
import { Card, CardHeader, EmptyState } from "@/components/app/primitives";
import { RotateCcw } from "lucide-react";
import RerunSearchButton from "@/features/searches/RerunSearchButton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext().catch(() => null);
  if (!ctx) return { title: "Search" };
  const search = await getSearch(ctx.workspaceId, id);
  return { title: search?.name ?? "Search" };
}

export default async function SearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const search = await getSearch(ctx.workspaceId, id);
  if (!search) notFound();

  const job = search.last_job_id ? await getJob(ctx.workspaceId, search.last_job_id) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/searches"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-ink/50 transition-colors hover:text-ink"
      >
        ← Back to searches
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {search.name ?? "Untitled search"}
          </h1>
          <p className="mt-1.5 font-mono text-[11px] text-ink/45">
            {search.keywords.join(", ")} · {search.locations.join(", ")} ·{" "}
            {new Date(search.created_at).toLocaleString("en-US", {
              month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
            })}
          </p>
        </div>
        <RerunSearchButton searchId={search.id} />
      </div>

      {job ? (
        <JobProgressPanel initialJob={job} searchId={search.id} />
      ) : (
        <Card>
          <EmptyState
            icon={RotateCcw}
            title="No job attached"
            body="This search doesn't have a scrape job yet. Re-run it to collect leads."
            action={<RerunSearchButton searchId={search.id} variant="lime" />}
          />
        </Card>
      )}

      {search.error_message && (
        <Card className="mt-5 border-red-200 bg-red-50/60">
          <CardHeader title="Error" />
          <p className="text-sm text-red-700">{search.error_message}</p>
        </Card>
      )}
    </div>
  );
}
