"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors sm:p-6",
        dark
          ? "border-white/10 bg-ink text-paper"
          : "border-ink/10 bg-white/70 shadow-[0_1px_2px_rgba(11,16,14,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  action,
  dark = false,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={cn("font-display text-lg font-bold tracking-tight", dark ? "text-paper" : "text-ink")}>
          {title}
        </h2>
        {sub && <p className={cn("mt-1 text-sm", dark ? "text-paper/50" : "text-ink/55")}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons                                                            */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "lime" | "outline" | "ghost" | "danger" | "ink";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-3 shadow-[0_8px_24px_-8px_rgba(11,16,14,0.5)]",
  lime: "bg-lime text-ink hover:shadow-[0_0_36px_rgba(216,255,62,0.4)]",
  outline: "border border-ink/15 bg-white text-ink hover:border-ink/35",
  ghost: "text-ink/65 hover:bg-ink/[0.05] hover:text-ink",
  danger: "bg-red-500 text-white hover:bg-red-600",
  ink: "bg-ink-2 text-paper hover:bg-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-[13px]",
  md: "px-4.5 py-2.5 text-sm",
  lg: "px-7 py-4 text-[0.95rem]",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Inputs                                                            */
/* ------------------------------------------------------------------ */

export const inputCls =
  "w-full rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5 text-[15px] text-ink placeholder:text-ink/35 outline-none transition-all focus:border-ink/50 focus:bg-white focus:ring-4 focus:ring-lime/40";

export function Input({
  label,
  error,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
          {label}
          {error && <span className="normal-case tracking-normal text-red-500">{error}</span>}
        </span>
      )}
      <input {...rest} className={cn(inputCls, error && "border-red-400", className)} />
      {hint && !error && <span className="mt-1.5 block text-xs text-ink/45">{hint}</span>}
    </label>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
          {label}
          {error && <span className="normal-case tracking-normal text-red-500">{error}</span>}
        </span>
      )}
      <textarea
        {...rest}
        className={cn(inputCls, "min-h-[110px] resize-y leading-relaxed", error && "border-red-400", className)}
      />
      {hint && !error && <span className="mt-1.5 block text-xs text-ink/45">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
          {label}
        </span>
      )}
      <select {...rest} className={cn(inputCls, "appearance-none pr-9", className)}>
        {children}
      </select>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 text-left disabled:opacity-50"
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink/55">{description}</span>}
      </span>
      <span
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-ink" : "bg-ink/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-transform",
            checked ? "translate-x-5.5 bg-lime" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Badges & status                                                    */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "lime" | "ink" | "amber" | "red" | "green";
  className?: string;
}) {
  const tones = {
    neutral: "border-ink/12 bg-ink/[0.04] text-ink/65",
    lime: "border-lime/40 bg-lime/15 text-forest",
    ink: "border-transparent bg-ink text-paper",
    amber: "border-amber-300/50 bg-amber-100 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const JOB_TONES: Record<string, "neutral" | "lime" | "amber" | "red" | "green"> = {
  queued: "neutral",
  starting: "neutral",
  running: "lime",
  paused: "amber",
  cancelling: "amber",
  completed: "green",
  failed: "red",
  cancelled: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={JOB_TONES[status] ?? "neutral"}>
      {status === "running" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {status}
    </Badge>
  );
}

const EMAIL_TONES: Record<string, "neutral" | "green" | "red" | "amber"> = {
  valid: "green",
  invalid: "red",
  risky: "amber",
  unknown: "neutral",
  pending: "neutral",
  accept_all: "amber",
  disposable: "red",
  suppressed: "red",
};

export function EmailStatusBadge({ status }: { status: string }) {
  return <Badge tone={EMAIL_TONES[status] ?? "neutral"}>{status.replace("_", " ")}</Badge>;
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  tone = "light",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  href?: string;
  tone?: "light" | "dark";
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-mono text-[10.5px] uppercase tracking-[0.18em]",
            tone === "dark" ? "text-paper/45" : "text-ink/50",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl",
            tone === "dark" ? "bg-white/10 text-lime" : "bg-ink/[0.06] text-ink/60",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("mt-3 font-display text-3xl font-bold tracking-tight", tone === "dark" ? "text-paper" : "text-ink")}>
        {value}
      </p>
      {sub && <p className={cn("mt-1 text-xs", tone === "dark" ? "text-paper/45" : "text-ink/50")}>{sub}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block rounded-2xl border p-5 transition-all hover:-translate-y-0.5",
          tone === "dark"
            ? "border-white/10 bg-ink text-paper hover:border-lime/30"
            : "border-ink/10 bg-white/70 hover:border-ink/20 hover:shadow-[0_16px_40px_-20px_rgba(11,16,14,0.25)]",
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        tone === "dark" ? "border-white/10 bg-ink text-paper" : "border-ink/10 bg-white/70",
      )}
    >
      {inner}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white/40 px-6 py-14 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink/[0.05] text-ink/40">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink/55">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-ink/10 bg-paper p-6 shadow-[0_40px_100px_-20px_rgba(11,16,14,0.5)] sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/60 transition-colors hover:text-ink"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {children}
            {footer && <div className="mt-6 flex justify-end gap-2.5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Misc                                                               */
/* ------------------------------------------------------------------ */

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em] sm:text-3xl">{children}</h1>
      {sub && <p className="mt-1.5 text-sm text-ink/55">{sub}</p>}
    </div>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink/10", className)}>
      <motion.div
        className="h-full rounded-full bg-lime"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: EASE }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-ink/[0.07]", className)} />;
}

export function Toast({
  message,
  tone = "info",
  onClose,
}: {
  message: string;
  tone?: "info" | "success" | "error";
  onClose: () => void;
}) {
  const tones = {
    info: "border-ink/15 bg-ink text-paper",
    success: "border-lime/40 bg-forest text-lime",
    error: "border-red-300 bg-red-500 text-white",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "fixed bottom-5 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-3 rounded-full border px-5 py-3 text-sm font-medium shadow-[0_20px_50px_-12px_rgba(11,16,14,0.5)]",
        tones[tone],
      )}
    >
      {message}
      <button onClick={onClose} className="opacity-60 transition-opacity hover:opacity-100" aria-label="Dismiss">
        ×
      </button>
    </motion.div>
  );
}
