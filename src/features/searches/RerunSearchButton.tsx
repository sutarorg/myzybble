"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/app/primitives";

/** Re-runs a historical search with its original parameters (§18). */
export default function RerunSearchButton({
  searchId,
  variant = "outline",
}: {
  searchId: string;
  variant?: "outline" | "lime" | "primary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rerun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/searches/${searchId}/rerun`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as { job?: { id: string }; search?: { id: string }; error?: { message: string } };
      if (!res.ok || !body.job) {
        setError(body.error?.message ?? "Could not re-run that search.");
        return;
      }
      router.refresh();
      router.push(`/searches/${body.search?.id ?? searchId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <Button variant={variant} onClick={rerun} loading={busy}>
        <RotateCcw className="h-4 w-4" />
        Re-run search
      </Button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
