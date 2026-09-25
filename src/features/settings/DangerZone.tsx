"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Modal, Input } from "@/components/app/primitives";
import { signOutAction } from "@/features/auth/actions";
import { Trash2, LogOut } from "lucide-react";

/**
 * Account deletion. Step one asks for the current password (verified
 * server-side) and emails a single-use link; nothing is deleted until that link
 * is opened.
 */
export default function DangerZone({ hasPendingRequest }: { hasPendingRequest: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(hasPendingRequest);
  const [pending, start] = useTransition();

  function requestDeletion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not start account deletion.");
        return;
      }
      setPassword("");
      setSent(true);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="!border-red-500/25">
      <h2 className="font-display text-lg font-bold tracking-tight text-red-700">Danger zone</h2>
      <p className="mt-1 text-sm text-ink/60">
        Deleting your account permanently removes your leads, lists, campaigns, searches and
        mailboxes. This can&apos;t be undone.
      </p>

      {sent && (
        <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
          We emailed you a confirmation link. Open it within 24 hours to finish deleting your
          account — nothing has been deleted yet.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="danger" onClick={() => setOpen(true)} disabled={sent}>
          <Trash2 className="h-3.5 w-3.5" />
          {sent ? "Check your email" : "Delete account"}
        </Button>
        <Button variant="ghost" onClick={() => signOutAction()}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Confirm account deletion">
        <form onSubmit={requestDeletion} className="space-y-4">
          <p className="text-sm text-ink/65">
            Enter your password to continue. We&apos;ll email you a one-time link that completes the
            deletion — so a stolen session alone can&apos;t destroy your data.
          </p>
          <Input
            label="Current password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={pending || password.length === 0}>
              {pending ? "Sending…" : "Email me the link"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
