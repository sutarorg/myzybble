import Link from "next/link";
import { requireAuthContext } from "@/server/auth";
import { listSearches } from "@/server/services/searches";
import { SectionTitle, Card, EmptyState, StatusBadge, LinkButton } from "@/components/app/primitives";
import { History, Crosshair, ArrowRight } from "lucide-react";

export const metadata = { title: "Searches" };

export default async function SearchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAuthContext();
  const sp = await searchParams;
  const offset = Math.max(0, Number(Array.isArray(sp.offset) ? sp.offset[0] : sp.offset ?? 0));

  const { searches, total } = await listSearches(ctx.workspaceId, { limit: 25, offset });

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle sub="Every search you've run, with its parameters, results and duration.">
          Searches
        </SectionTitle>
        <LinkButton href="/find-leads" variant="lime">
          <Crosshair className="h-4 w-4" />
          New search
        </LinkButton>
      </div>

      {searches.length === 0 ? (
        <EmptyState
          icon={History}
          title="No searches yet"
          body="Run a search to extract businesses from Google Maps. Every search is saved here so you can re-run it later."
          action={
            <LinkButton href="/find-leads" variant="lime">
              Run your first search
            </LinkButton>
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-ink/8">
            {searches.map((search) => (
              <li key={search.id}>
                <Link
                  href={`/searches/${search.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-ink/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{search.name ?? "Untitled search"}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-ink/45">
                      {search.keywords.join(", ")} · {search.locations.join(", ")}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-ink/40">
                      <span>{new Date(search.created_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}</span>
                      {search.duration_ms !== null && (
                        <span>{Math.round(search.duration_ms / 1000)}s</span>
                      )}
                      <span>{search.requested_limit.toLocaleString()} requested</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-right">
                      <span className="block font-display text-lg font-bold tabular-nums">
                        {search.result_count.toLocaleString()}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">leads</span>
                    </span>
                    <StatusBadge status={search.status} />
                    <ArrowRight className="h-4 w-4 text-ink/25" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-ink/8 px-5 py-3.5">
            <span className="font-mono text-[11px] text-ink/45">
              {total !== null ? `${total.toLocaleString()} searches` : ""}
            </span>
            <div className="flex gap-2">
              {offset > 0 && (
                <Link
                  href={`/searches?offset=${Math.max(0, offset - 25)}`}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 hover:text-ink"
                >
                  Previous
                </Link>
              )}
              {searches.length === 25 && (
                <Link
                  href={`/searches?offset=${offset + 25}`}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 hover:text-ink"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
