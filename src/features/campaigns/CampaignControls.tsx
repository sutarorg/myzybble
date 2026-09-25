"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/primitives";
import { Play, Pause, RotateCcw, X } from "lucide-react";

type Status = "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";

/**
 * Start / pause / resume / cancel. Sends to the server only — the browser never
 * triggers sending directly; a cron-driven worker picks up `running` campaigns.
 */
export default function CampaignControls({
  campaignId,
  status,
  recipients,
}: {
  campaignId: string;
  status: Status;
  recipients: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function set(next: Status) {
    start(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    });
  }

  const disabled = pending || recipients === 0;

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "draft" || status === "paused" || status === "scheduled") && (
        <Button variant="lime" disabled={disabled} onClick={() => set("running")}>
          <Play className="h-3.5 w-3.5" />
          {status === "paused" ? "Resume" : "Start"}
        </Button>
      )}
      {status === "running" && (
        <Button variant="outline" disabled={pending} onClick={() => set("paused")}>
          <Pause className="h-3.5 w-3.5" />
          Pause
        </Button>
      )}
      {(status === "paused" || status === "cancelled") && (
        <Button variant="ghost" disabled={pending} onClick={() => set("running")}>
          <RotateCcw className="h-3.5 w-3.5" />
          Restart
        </Button>
      )}
      {(status === "running" || status === "paused" || status === "scheduled") && (
        <Button variant="danger" disabled={pending} onClick={() => set("cancelled")}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      )}
    </div>
  );
}
