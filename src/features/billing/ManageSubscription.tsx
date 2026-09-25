"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/app/primitives";
import { XCircle, RotateCcw } from "lucide-react";

export default function ManageSubscription({
  subscriptionId,
  status,
  cancelAtPeriodEnd,
}: {
  subscriptionId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel(immediate: boolean) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/billing/subscription", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ immediate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "Could not cancel the subscription.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-bold tracking-tight">Manage subscription</h2>
      <p className="mt-1 text-sm text-ink/55">
        Status: <span className="font-medium text-ink">{status}</span>
        {cancelAtPeriodEnd && " · scheduled to cancel at the end of this period"}
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4">
        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm text-ink/70">
              Cancel at the end of the period (you keep access until then), or cancel immediately?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={pending} onClick={() => cancel(false)}>
                {pending ? "Working…" : "Cancel at period end"}
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => cancel(true)}>
                Cancel immediately
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep subscription
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)} disabled={status === "cancelled"}>
            {cancelAtPeriodEnd ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" /> Resume subscription
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5" /> Cancel subscription
              </>
            )}
          </Button>
        )}
      </div>
      <p className="mt-3 font-mono text-[10.5px] text-ink/35">subscription {subscriptionId}</p>
    </Card>
  );
}
