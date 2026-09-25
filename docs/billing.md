# Billing

## Pricing

Seven tiers, all USD, all monthly. Every paid plan includes email data, phone
data, CSV export, the AI Assistant and Campaigns — there are no feature gates
between paid tiers, only volume.

| Code | Name | Price | Leads / month |
| --- | --- | --- | --- |
| `free` | Free | $0 | 100 |
| `starter` | Starter | $19 | 5,000 |
| `growth` | Growth | $39 | 15,000 |
| `pro` | Pro | $69 | 30,000 |
| `scale` | Scale | $99 | 50,000 |
| `business` | Business | $149 | 75,000 |
| `agency` | Agency | $199 | 100,000 |

Seeded by migration `0013_seed_plans.sql`.

**The price list lives in Postgres.** `plans` is the only source of truth for
what a plan costs and includes. The client sends a plan *code*; it never sends
a price, a quota or a status.

## What counts as a billable lead

> **A billable lead is a unique lead successfully persisted.**

Concretely, `upsert_lead()` writes one `usage_events` row with idempotency key
`lead:<lead_id>` — and only when the lead is new.

| Outcome | Billed? | Counter |
| --- | --- | --- |
| New unique lead persisted | **Yes** | `billable_leads` +1 |
| Matched an existing lead (dedupe hit) | No | `duplicates` +1 |
| Dropped by a user filter | No | `filtered` +1 |
| Failed to parse/persist | No | `errors` +1 |

Because the idempotency key is the lead id, a duplicate can't be billed twice
even if the same business is seen in ten different searches.

## Entitlements

`entitlements` is a materialised snapshot, recomputed by
`recompute_entitlements(workspace_id)` whenever something changes:

```
plan_code, plan_name, monthly_leads, leads_used, leads_remaining,
status, has_email_data, has_phone_data, has_csv_export,
has_ai_assistant, has_campaigns, max_seats,
period_start, period_end, cancel_at_period_end
```

The UI reads it. Nothing treats it as writable — the table has no user-facing
write policy.

### Quota enforcement

Three independent gates:

1. **Before job creation** — `assertCapacity(workspaceId, requestedLimit)`
   rejects the request and caps the effective limit to `leads_remaining`.
2. **During the job** — the worker re-checks remaining quota before persisting
   each batch and stops when it hits zero.
3. **At persistence** — `upsert_lead()` records usage idempotently, so
   concurrent writes can't overcount.

Plus: `scrape_jobs_one_active_per_workspace` prevents running several jobs in
parallel to get around the limit.

### Period handling

- Periods are calendar months, computed by `period_start()`.
- `leads_remaining = max(0, monthly_leads - leads_used)`.
- On renewal, `leads_used` resets via the new period's row; the old row is
  retained for history (`getUsageHistory`).
- **Upgrade** — the quota increases immediately; the worker sees it on the next
  check.
- **Downgrade** — Razorpay cancels the old subscription at cycle end, so the
  customer keeps what they paid for until then. The entitlement only changes
  when the webhook confirms the new subscription is active.
- **Cancellation** — `cancel_at_period_end` keeps access until `period_end`;
  the entitlement keeps its quota until then and drops to the free plan after.
- **Failed payment** — `failed_payment_count` increments, a notification is
  written, and `payment_failed` email is sent (idempotent per invoice). Access
  is not revoked instantly; Razorpay's retry schedule decides.

## Razorpay setup

1. **Enable international payments.** USD/international settlement must be
   activated on the account; it is not on by default.
2. **Create plans.** One Razorpay plan per tier. Record the plan ids back onto
   `plans.razorpay_plan_id` — `createCheckoutSubscription()` refuses to start
   checkout until this is set.
3. **Create the webhook.** Point it at
   `https://your-domain.com/api/webhooks/razorpay` and subscribe to:
   `payment.captured`, `payment.authorized`, `payment.failed`,
   `subscription.activated`, `subscription.charged`, `subscription.authenticated`,
   `subscription.pending`, `subscription.halted`, `subscription.cancelled`,
   `subscription.completed`, `subscription.paused`, `subscription.resumed`.
4. **Copy the webhook secret** into `RAZORPAY_WEBHOOK_SECRET`. It is a
   different value from the API key secret.

## Webhook handling

`/api/webhooks/razorpay` enforces, in order:

1. **Read the raw body as text.** HMAC signs *bytes*. Calling `JSON.parse`
   first and re-serialising changes key order and whitespace, so the digest
   would never match.
2. **Verify `X-Razorpay-Signature`** = HMAC-SHA256(rawBody, webhook secret),
   hex, compared with a constant-time equality check.
3. **Record the event** in `billing_events` with `signature_valid`, before
   acting on it. An invalid signature is stored for auditing and rejected with
   401 — it is never applied.
4. **Replay guard.** A unique index on `(provider, provider_event_id)` makes a
   duplicate delivery a no-op that still returns 200 (so Razorpay stops
   retrying).
5. **Apply the state change** and recompute entitlements.
6. **Return 500 on handler failure** so Razorpay retries; the idempotency
   guard makes the retry safe.

### Status mapping

| Razorpay | Internal |
| --- | --- |
| `created`, `authenticated` | `incomplete` |
| `active` | `active` |
| `pending` | `past_due` / `trialing` |
| `halted` | `unpaid` / `paused` |
| `paused` | `paused` |
| `cancelled`, `completed` | `cancelled` / `expired` |

Unknown states map to **`incomplete`** — never `active`. Failing closed is the
whole point.

## Checkout flow

```
browser                    server                     Razorpay
   │                         │                            │
   ├─ POST /billing/checkout ▶│                            │
   │                         ├─ create/reuse customer     │
   │                         ├─ create subscription ─────▶│
   │◀── { key_id, sub_id } ──┤◀───────────────────────────│
   │                         │                            │
   ├─ open Checkout widget ──────────────────────────────▶│
   │◀──────────────── payment result ─────────────────────│
   │                         │                            │
   │                         │◀── webhook (signed) ───────┤
   │                         ├─ verify + record + apply   │
   │                         │                            │
   ├─ poll /billing/subscription until status = active ───▶│
```

Two things to note:

- **Only the public `key_id` and the subscription id reach the browser.** The
  key secret never leaves the server.
- **The widget's success callback does not activate anything.** It only tells
  the UI to start polling our own subscription endpoint until the webhook has
  landed. A browser that claims "payment succeeded" is not evidence.

## Audit trail

`billing_events` records every delivery: event type, provider event id, whether
the signature was valid, the processing status and any error. It's rendered on
`/billing` so a customer can see what we received — including a
`bad signature` badge when a delivery failed verification.

## Testing

- `tests/unit/billing.test.ts` — status mapping, webhook and payment signature
  verification, retry backoff.
- `tests/integration/razorpay-webhook.test.ts` — the webhook contract against
  synthetic payloads: tampered bodies, wrong secrets, truncated signatures,
  and the byte-for-byte raw-body requirement.

Neither suite talks to Razorpay's network.
