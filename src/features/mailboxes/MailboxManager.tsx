"use client";

/**
 * Mailbox CRUD + verification.
 *
 * SMTP passwords are write-only: the list only ever reports whether one is
 * stored, and the form never pre-fills it. Verification is checked against the
 * provider's verified-domain list server-side.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Button,
  Input,
  Select,
  Modal,
  Badge,
  EmptyState,
  StatusBadge,
} from "@/components/app/primitives";
import { Mailbox, Plus, ShieldCheck, Trash2, Pencil } from "lucide-react";

export interface MailboxItem {
  id: string;
  name: string;
  email: string;
  provider: string;
  status: string;
  dailySendLimit: number;
  sentToday: number;
  verifiedAt: string | null;
  lastError: string | null;
  hasSmtpPassword: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  createdAt: string;
}

export default function MailboxManager({ mailboxes }: { mailboxes: MailboxItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MailboxItem | null>(null);
  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button
          variant="lime"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add mailbox
        </Button>
      </div>

      {mailboxes.length === 0 ? (
        <EmptyState
          icon={Mailbox}
          title="No mailboxes yet"
          body="Add a sending mailbox so campaigns can deliver. Resend is the default provider; SMTP is supported too."
          action={
            <Button
              variant="lime"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add mailbox
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mailboxes.map((mailbox) => (
            <Card key={mailbox.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-bold tracking-tight">
                    {mailbox.name}
                  </h3>
                  <p className="truncate font-mono text-[11px] text-ink/45">{mailbox.email}</p>
                </div>
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    mailbox.status === "verified" ? "bg-lime text-ink" : "bg-ink/6 text-ink/45"
                  }`}
                >
                  <Mailbox className="h-4.5 w-4.5" />
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={mailbox.status} />
                <Badge tone="neutral">{mailbox.provider}</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/8 pt-4">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">
                    Sent today
                  </dt>
                  <dd className="font-display text-lg font-bold">
                    {mailbox.sentToday.toLocaleString()}
                    <span className="text-sm font-normal text-ink/40">
                      {" "}
                      / {mailbox.dailySendLimit.toLocaleString()}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">
                    SMTP password
                  </dt>
                  <dd className="mt-0.5 font-mono text-xs text-ink/60">
                    {mailbox.hasSmtpPassword ? "stored encrypted" : "not set"}
                  </dd>
                </div>
              </dl>

              {mailbox.lastError && (
                <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-800">
                  {mailbox.lastError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {mailbox.status !== "verified" && (
                  <VerifyButton mailboxId={mailbox.id} />
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(mailbox);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <DeleteButton mailboxId={mailbox.id} name={mailbox.name} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <MailboxForm
        open={open}
        editing={editing}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setOpen(false);
          setEditing(null);
          router.refresh();
        }}
      />
    </>
  );
}

function VerifyButton({ mailboxId }: { mailboxId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch(`/api/mailboxes/${mailboxId}/verify`, { method: "POST" });
          router.refresh();
        })
      }
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {pending ? "Checking…" : "Verify"}
    </Button>
  );
}

function DeleteButton({ mailboxId, name }: { mailboxId: string; name: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-ink/60">Delete “{name}”?</span>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await fetch(`/api/mailboxes/${mailboxId}`, { method: "DELETE" });
            setConfirming(false);
            router.refresh();
          })
        }
      >
        {pending ? "Deleting…" : "Yes"}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        No
      </Button>
    </span>
  );
}

function MailboxForm({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: MailboxItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState<"resend" | "smtp">("resend");
  const [dailySendLimit, setDailySendLimit] = useState(200);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Reset the form whenever it is opened for a different (or new) mailbox.
  const [loaded, setLoaded] = useState<string | null>(null);
  if (open && loaded !== (editing?.id ?? "new")) {
    setLoaded(editing?.id ?? "new");
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setProvider((editing?.provider as "resend" | "smtp") ?? "resend");
    setDailySendLimit(editing?.dailySendLimit ?? 200);
    setSmtpHost(editing?.smtpHost ?? "");
    setSmtpPort(editing?.smtpPort ?? 587);
    setSmtpUsername(editing?.smtpUsername ?? "");
    // Never pre-fill the password — it is write-only.
    setSmtpPassword("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const payload = {
        name,
        email,
        provider,
        dailySendLimit,
        ...(provider === "smtp"
          ? {
              smtpHost: smtpHost || null,
              smtpPort,
              smtpUsername: smtpUsername || null,
              smtpPassword: smtpPassword || null,
            }
          : {}),
      };
      const res = editing
        ? await fetch(`/api/mailboxes/${editing.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/mailboxes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not save that mailbox.");
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit mailbox" : "Add mailbox"}>
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Outbound — sales"
          required
          maxLength={120}
        />
        <Input
          label="From email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sales@yourdomain.com"
          required
          disabled={Boolean(editing)}
          hint={editing ? "The from address can't be changed — create a new mailbox instead." : undefined}
        />
        <Select
          label="Provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as "resend" | "smtp")}
          disabled={Boolean(editing)}
        >
          <option value="resend">Resend</option>
          <option value="smtp">SMTP</option>
        </Select>
        <Input
          label="Daily send limit"
          type="number"
          min={1}
          max={2000}
          value={dailySendLimit}
          onChange={(e) =>
            setDailySendLimit(Math.min(2000, Math.max(1, Number(e.target.value) || 1)))
          }
        />

        {provider === "smtp" && (
          <div className="space-y-4 rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">
              SMTP credentials
            </p>
            <Input
              label="Host"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.yourdomain.com"
            />
            <Input
              label="Port"
              type="number"
              min={1}
              max={65535}
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
            />
            <Input
              label="Username"
              value={smtpUsername}
              onChange={(e) => setSmtpUsername(e.target.value)}
              autoComplete="off"
            />
            <Input
              label={editing ? "New password (leave blank to keep current)" : "Password"}
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              autoComplete="new-password"
              hint="Encrypted with AES-256-GCM before it's written to the database. It is never returned to the browser or written to logs."
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="lime" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add mailbox"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
