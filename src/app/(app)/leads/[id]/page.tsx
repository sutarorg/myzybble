import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthContext } from "@/server/auth";
import { getLead, getLeadContacts, getLeadLists } from "@/server/services/leads";
import LeadDetail from "@/features/leads/LeadDetail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext().catch(() => null);
  if (!ctx) return { title: "Lead" };
  const lead = await getLead(ctx.workspaceId, id);
  return { title: lead?.business_name ?? "Lead" };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const lead = await getLead(ctx.workspaceId, id);
  if (!lead) notFound();

  const [contacts, lists, { listLists }] = await Promise.all([
    getLeadContacts(ctx.workspaceId, id),
    getLeadLists(ctx.workspaceId, id),
    import("@/server/services/lists"),
  ]);

  const allLists = await listLists(ctx.workspaceId);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-ink/50 transition-colors hover:text-ink"
      >
        ← Back to leads
      </Link>
      <LeadDetail lead={lead} contacts={contacts} lists={lists} allLists={allLists} />
    </div>
  );
}
