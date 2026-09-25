"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Archive } from "lucide-react";
import { Button, Modal, Input, Textarea } from "@/components/app/primitives";
import type { ListRow } from "@/types/database";

export default function ListActions({ list }: { list: ListRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !list.archived_at }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete the list "${list.name}"? The leads themselves are not deleted.`)) return;
    const res = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/lists");
      router.refresh();
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="md" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Rename
        </Button>
        <Button variant="outline" size="md" onClick={toggleArchive} aria-label="Archive list">
          <Archive className="h-4 w-4" />
        </Button>
        <Button variant="danger" size="md" onClick={remove} aria-label="Delete list">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Rename list"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="lime" onClick={save} disabled={!name.trim()} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}
