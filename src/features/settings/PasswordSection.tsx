"use client";

import { useState } from "react";
import { Card, Button, Input } from "@/components/app/primitives";
import { createClient } from "@/lib/supabase/client";
import { KeyRound } from "lucide-react";

/**
 * Password change. The current password is re-verified by Supabase before the
 * new one is accepted, so a hijacked session can't lock the owner out.
 */
export default function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (next.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // Re-authenticate first: updateUser alone would accept a stale session.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: (await supabase.auth.getUser()).data.user?.email ?? "",
      password: current,
    });
    if (signInError) {
      setError("That current password is incorrect.");
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updateError) {
      setError("We couldn't change your password. Please try again.");
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-bold tracking-tight">Password</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Input
          label="Current password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="New password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        {done && (
          <p className="rounded-xl bg-lime/20 px-4 py-3 text-sm text-ink">
            Password updated. We&apos;ve sent a security email to your address.
          </p>
        )}

        <Button type="submit" variant="outline" disabled={busy}>
          <KeyRound className="h-3.5 w-3.5" />
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}
