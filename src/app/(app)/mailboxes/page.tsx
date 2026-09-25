import { requireAuthContext } from "@/server/auth";
import { listMailboxes } from "@/server/services/campaigns";
import { SectionTitle } from "@/components/app/primitives";
import MailboxManager from "@/features/mailboxes/MailboxManager";

export const metadata = { title: "Mailboxes" };

export default async function MailboxesPage() {
  const ctx = await requireAuthContext();
  const mailboxes = await listMailboxes(ctx.workspaceId);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionTitle sub="Sending identities for campaigns. SMTP credentials are encrypted at rest and never exposed to the browser.">
        Mailboxes
      </SectionTitle>
      <MailboxManager mailboxes={mailboxes} />
    </div>
  );
}
