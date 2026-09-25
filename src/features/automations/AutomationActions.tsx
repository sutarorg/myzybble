"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/primitives";
import { AutomationForm, type AutomationDraft, type Option } from "./AutomationBuilder";
import { Pencil, Play, Pause, Trash2 } from "lucide-react";

export default function AutomationActions({
  automationId,
  status,
  initial,
  lists,
  campaigns,
}: {
  automationId: string;
  status: string;
  initial: AutomationDraft;
  lists: Option[];
  campaigns: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function setStatus(next: "active" | "paused" | "draft") {
    start(async () => {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>

      {status === "active" ? (
        <Button variant="outline" disabled={pending} onClick={() => setStatus("paused")}>
          <Pause className="h-3.5 w-3.5" /> Pause
        </Button>
      ) : (
        <Button variant="lime" disabled={pending} onClick={() => setStatus("active")}>
          <Play className="h-3.5 w-3.5" /> Activate
        </Button>
      )}

      {confirming ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-xs text-ink/60">Delete?</span>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await fetch(`/api/automations/${automationId}`, {
                  method: "DELETE",
                });
                if (res.ok) router.push("/automations");
              })
            }
          >
            {pending ? "Deleting…" : "Yes"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            No
          </Button>
        </span>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      )}

      <AutomationForm
        open={open}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
        initial={{ ...initial, id: automationId }}
        lists={lists}
        campaigns={campaigns}
      />
    </div>
  );
}
