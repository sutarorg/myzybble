# Email

Two distinct kinds of mail leave zybble, and they behave differently.

| | Transactional | Campaign |
| --- | --- | --- |
| Trigger | Lifecycle event (signup, receipt, search finished…) | Scheduled sequence step |
| Opt-out | Account notification preferences | One-click unsubscribe link |
| Suppression list | Not applied | **Applied before every send** |
| Idempotency | Key per event + entity | Key per (campaign, lead, step) |

## Provider

Resend. The sender is configuration (`EMAIL_FROM`), so changing domain or
provider doesn't touch application logic.

## Setup

1. Add and verify your domain in [Resend](https://resend.com/domains). The
   default `onboarding@resend.dev` only delivers to your own account.
2. Create an API key → `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on the verified domain.
4. Add the domain to `RESEND_VERIFIED_DOMAINS` (comma-separated). A mailbox can
   only be marked `verified` once its domain appears here.
5. Point delivery webhooks at `/api/webhooks/resend` and set
   `RESEND_WEBHOOK_SECRET`.

## Templates

All templates live in `src/server/services/email.ts` and share one responsive
layout with the zybble palette:

| Template | Sent when |
| --- | --- |
| `welcome` | Account created |
| `emailVerification` | Email confirmation requested |
| `passwordReset` | Reset requested |
| `passwordChanged` | Password changed (security) |
| `paymentSucceeded` | Subscription payment captured |
| `paymentFailed` | Payment failed |
| `subscriptionChanged` | Plan upgraded/downgraded/renewed |
| `searchCompleted` | A search finished, with the new-lead count |
| `searchFailed` | A search failed, with the reason |
| `usageThreshold` | Approaching the monthly lead limit |
| `campaignCompleted` | A campaign finished sending |
| `accountDeletionRequested` | Deletion requested (with the one-time link) |

Every one has both HTML and plain-text parts.

## Idempotency

Every send carries an idempotency key of the form `<event-type>/<entity-id>`.
Resend deduplicates on it for 24 hours.

The keys are chosen so that a retry is a no-op but a genuine repeat still sends:

| Email | Key |
| --- | --- |
| Welcome | `welcome/<email>` |
| Password reset | `password-reset/<email>/<hour>` |
| Password changed | `password-changed/<email>/<minute>` |
| Account deletion | `account-deletion/<email>/<hour>` |
| Search completed | `search-completed/<searchId>` |
| Search failed | `search-failed/<searchId>` |
| Payment succeeded | `payment-succeeded/<paymentId>` |
| Payment failed | `payment-failed/<invoiceId>` |
| Subscription changed | `subscription-changed/<subscriptionId>/<revision>` |
| Usage threshold | `usage-threshold/<email>/<periodStart>` |
| Campaign completed | `campaign-completed/<campaignId>` |

The time buckets matter: a reset link lives for an hour, so a second request
inside that hour is a real re-request — but the same webhook replayed fifty
times is not.

## Notification preferences

Before every transactional send the code checks the recipient's preferences
(`notification_preferences`, seeded by migration 0014). An opted-out user is
never emailed, even if a webhook fires.

Security-critical mail (payment failures, account deletion) is always sent to a
verified address regardless of toggles — that's stated in the UI so it isn't a
surprise.

## Campaign sending

Sending is **server-side only**. The browser can create, pause and schedule a
campaign; only `/api/cron/campaigns` actually sends.

Before each send:

1. Recipient is not on the workspace suppression list.
2. Recipient has an email the campaign is allowed to use.
3. The mailbox's daily cap has not been reached (`sent_today < daily_send_limit`).
4. The campaign is `running` and the step's `next_run_at` has passed.
5. The step's idempotency key has not already been consumed.

Then the email is rendered server-side from the step template with
`{{variables}}` substituted at send time — so a hostile business name in the
lead data cannot inject content into the request the browser makes.

Every campaign email carries a `List-Unsubscribe` header and a footer link to
`/api/unsubscribe?token=…`.

## Unsubscribe and suppression

The token is per `(campaign, lead)` and unique. Following it:

1. Looks up the recipient.
2. Adds the address to `suppression_entries` for the **workspace** — not just
   this campaign.
3. Marks the recipient row unsubscribed.

Suppression is consulted before every campaign send, so one unsubscribe stops
all current and future campaigns from that workspace. It does not affect
transactional account email, which is a separate channel (and a separate legal
basis).

## Bounces and complaints

Resend webhook events land in `email_events`, which records the provider event
id, type, email, campaign and payload, plus whether the signature was valid.

- `bounced` → add to suppression, mark the recipient bounced.
- `complained` → add to suppression immediately.
- `delivered` / `opened` / `replied` → update the recipient row and campaign stats.

Replays are deduplicated on the provider event id.

## Mailboxes

`mailboxes` stores the sending identity. SMTP passwords are encrypted with
AES-256-GCM using `MAILBOX_ENCRYPTION_KEY` before being written, and are:

- never returned to the API (the response reports only `hasSmtpPassword`),
- never pre-filled in the edit form,
- never logged.

Resend-hosted mailboxes need no credentials at all. Verification checks the
domain against `RESEND_VERIFIED_DOMAINS`.

## Failure handling

`sendEmail()` returns a result object rather than throwing, so a provider
outage degrades gracefully instead of breaking a signup or a search
completion — but it always logs the failure with a request id.

The Resend SDK is retried only on 429 and 5xx. A 403 means the domain isn't
verified, which retrying will not fix.
