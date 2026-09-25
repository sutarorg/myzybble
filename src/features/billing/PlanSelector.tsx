"use client";

/**
 * Plan selection + Razorpay Checkout.
 *
 * The browser only ever receives Razorpay's public `key_id` and a subscription
 * id. Opening Checkout does **not** activate anything — the signature-verified
 * webhook is the only thing that grants entitlement (§11), which is why after
 * payment we poll our own subscription endpoint instead of trusting the
 * widget's success callback.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/app/primitives";
import { Loader2, Check } from "lucide-react";

export interface PlanView {
  code: string;
  name: string;
  priceCents: number;
  currency: string;
  monthlyLeads: number;
  current: boolean;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: any;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PlanSelector({ plans }: { plans: PlanView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /**
   * After the widget reports success we poll *our* subscription until the
   * webhook has actually applied it (or give up after ~60s). This is what makes
   * "payment succeeded" a server-verified fact rather than a browser claim.
   */
  function waitForActivation() {
    setActivating(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const res = await fetch("/api/billing/subscription", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (body?.subscription?.status === "active") {
        if (pollRef.current) clearInterval(pollRef.current);
        setActivating(false);
        router.refresh();
        return;
      }
      if (attempts >= 12) {
        if (pollRef.current) clearInterval(pollRef.current);
        setActivating(false);
        setError(
          "Payment received, but activation is still pending. It usually completes within a minute — refresh to check.",
        );
        router.refresh();
      }
    }, 5_000);
  }

  function checkout(planCode: string) {
    setError(null);
    start(async () => {
      const loaded = await loadCheckout();
      if (!loaded) {
        setError("Couldn't load the payment widget. Check your connection and try again.");
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not start checkout.");
        return;
      }

      const options = {
        key: body.razorpayKeyId,
        subscription_id: body.razorpaySubscriptionId,
        name: "zybble",
        description: `${body.planName} — monthly`,
        theme: { color: "#0B100E" },
        handler: () => waitForActivation(),
        modal: {
          ondismiss: () =>
            setError("Checkout was closed before payment completed. Nothing was charged."),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const widget = new window.Razorpay(options as any);
      widget.open();
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <div
          key={plan.code}
          className={`relative flex flex-col rounded-2xl border bg-white/70 p-5 ${
            plan.current ? "border-ink shadow-[0_20px_50px_-24px_rgba(11,16,14,0.35)]" : "border-ink/10"
          }`}
        >
          {plan.current && (
            <span className="absolute -top-2.5 left-5">
              <Badge tone="lime">current plan</Badge>
            </span>
          )}

          <h3 className="font-display text-lg font-bold tracking-tight">{plan.name}</h3>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight">
            ${(plan.priceCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="text-sm font-normal text-ink/45">/mo</span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink/45">
            {plan.monthlyLeads.toLocaleString()} leads / month · {plan.currency}
          </p>

          <ul className="mt-4 flex-1 space-y-2">
            {[
              "Email data",
              "Phone data",
              "CSV export",
              "AI Assistant",
              "Campaigns",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-ink/65">
                <Check className="h-3.5 w-3.5 shrink-0 text-lime" strokeWidth={3} />
                {feature}
              </li>
            ))}
          </ul>

          <Button
            variant={plan.current ? "outline" : "lime"}
            className="mt-5 w-full"
            disabled={plan.current || pending || activating}
            onClick={() => checkout(plan.code)}
          >
            {pending || activating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : plan.current ? (
              "Current plan"
            ) : (
              `Upgrade to ${plan.name}`
            )}
          </Button>
        </div>
      ))}

      {error && (
        <p role="alert" className="sm:col-span-2 lg:col-span-3 rounded-xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {activating && (
        <p className="sm:col-span-2 lg:col-span-3 rounded-xl bg-lime/20 px-4 py-3 text-sm text-ink">
          Payment received — waiting for the webhook to activate your plan. This page updates
          automatically.
        </p>
      )}
    </div>
  );
}
