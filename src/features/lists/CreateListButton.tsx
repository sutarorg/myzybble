"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Modal, Input, Textarea } from "@/components/app/primitives";

export default function CreateListButton({
  variant = "outline",
  leadIds,
  label = "New list",
}: {
  variant?: "outline" | "lime" | "primary";
  leadIds?: string[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const body = (await res.json()) as { list?: { id: string }; error?: { message: string } };
      if (!res.ok || !body.list) {
        setError(body.error?.message ?? "Could not create that list.");
        return;
      }

      if (leadIds?.length) {
        await fetch(`/api/lists/${body.list.id}/members`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadIds }),
        });
      }

      setOpen(false);
      setName("");
      setDescription("");
      router.refresh();
      router.push(`/lists/${body.list.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a list"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="lime" onClick={create} disabled={!name.trim()} loading={busy}>
              Create list
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Denver roofers — Q3"
            error={error ?? undefined}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context for your team."
          />
          {leadIds?.length ? (
            <p className="text-xs text-ink/50">
              {leadIds.length} selected lead{leadIds.length === 1 ? "" : "s"} will be added automatically.
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
