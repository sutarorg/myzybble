"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Input, Button, Select } from "@/components/app/primitives";
import { Megaphone } from "lucide-react";

export interface MailboxOption {
  id: string;
  name: string;
  email: string;
  status: string;
}

export default function CreateCampaignButton({
  mailboxes,
  variant = "default",
}: {
  mailboxes: MailboxOption[];
  variant?: "default" | "lime";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const verified = mailboxes.filter((m) => m.status === "verified");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, mailboxId: mailboxId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not create that campaign.");
        return;
      }
      setOpen(false);
      setName("");
      router.push(`/campaigns/${body.campaign.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant={variant === "lime" ? "lime" : "primary"} onClick={() => setOpen(true)}>
        <Megaphone className="h-4 w-4" />
        New campaign
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New campaign">
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dentists — Berlin — Q4 outreach"
            required
            maxLength={160}
          />
          {verified.length === 0 ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
              You need a verified mailbox before a campaign can send. Add one in{" "}
              <a href="/mailboxes" className="font-semibold underline underline-offset-2">
                Mailboxes
              </a>
              . You can still build the campaign now.
            </p>
          ) : (
            <Select
              label="Sending mailbox"
              value={mailboxId}
              onChange={(e) => setMailboxId(e.target.value)}
            >
              {verified.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.email}
                </option>
              ))}
            </Select>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="lime" disabled={pending || name.trim().length === 0}>
              {pending ? "Creating…" : "Create campaign"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
