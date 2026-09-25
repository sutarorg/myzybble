# AI Assistant

The assistant is Gemini with function calling over *your* workspace data. It is
not a chatbot that opines about lead generation — it queries the database and
reports what it found.

## Configuration

| Variable | Where | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server only | From [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Server only | Optional override; defaults to `gemini-3.8-flash` |

The key is never exposed: `src/lib/env.ts` is marked `server-only`, and the
browser only ever talks to `/api/ai/*`.

## Model

The default is **`gemini-3.8-flash`**, with an automatic fallback chain tried in
order on failure:

```
GEMINI_MODEL (default gemini-3.8-flash)
  → gemini-3.8-flash
  → gemini-3-flash-preview
  → gemini-2.5-flash
```

The fallback exists so a model deprecation or a transient upstream error
degrades to "slower" rather than "broken". The model actually used is recorded
on `ai_conversations.model`.

When `GEMINI_API_KEY` is absent, `/api/ai/chat` returns a clear 503 and
`/ai` shows an explanatory card. It does not fake a response.

## Tools

Nine function declarations, all executed server-side with the caller's
workspace already resolved from their session — the model cannot reach another
tenant's data even if it asks.

| Tool | What it does |
| --- | --- |
| `search_leads` | Full-text + filtered search over stored leads |
| `get_lead` | Fetch one lead with emails, phones, tags, source metadata |
| `get_list` | Fetch a list and its members |
| `filter_leads` | Structured filter with counts |
| `create_search` | **Proposes** a new scrape (needs confirmation) |
| `create_list` | **Proposes** a new list (needs confirmation) |
| `create_campaign` | **Proposes** a campaign (needs confirmation) |
| `get_usage` | Current period usage and remaining quota |
| `get_subscription` | Plan, status, renewal date |

## Grounding rules

These are enforced in the system instruction and in how the response is
rendered.

1. **Never answer from memory about a business.** Any question about leads,
   contacts or counts must go through a tool. If the data isn't there, the
   assistant says it isn't there.
2. **Distinguish four kinds of statement:**
   - **Stored data** — came from a tool call. Rendered with a tool badge.
   - **Analysis** — the model's reasoning *about* that data.
   - **Copy** — text it drafted for outreach. Labelled as copy, not fact.
   - **Unknown** — it doesn't know, and says so.
3. **No invented metrics.** If a count wasn't returned by a tool, the assistant
   does not produce one.

The UI reinforces this: tool calls appear as badges above the reply, and a
persistent footnote explains that badge-marked content is stored data while
everything else is analysis or copy.

## Confirmation for expensive actions

`create_search`, `create_list` and `create_campaign` do not execute when the
model calls them. They are returned as `pendingActions`:

```json
{
  "id": "act_01H…",
  "type": "create_search",
  "label": "Search 500 dentists in Berlin",
  "reason": "This will use 500 of your 5,000 remaining leads.",
  "params": { "keywords": ["dentist"], "locations": ["Berlin"], "requestedLimit": 500 }
}
```

The UI renders each one as an explicit **Run it** button. Only a signed-in
user's click executes it, via `POST /api/ai/confirm` — which re-validates,
re-checks quota, and uses the action's `id` as its idempotency key so a
double-click can't run it twice.

## Persistence

- `ai_conversations` — one row per thread, titled from the first message, with
  the model actually used.
- `ai_messages` — every turn, including tool calls and results, with a
  `provenance` column (`stored_data | model | system | user`).

Conversations are listed in the sidebar and can be resumed. The last 40
messages are replayed as context.

## Guards

- **Rate limit** — 30 requests/minute per user (Postgres-backed).
- **Input cap** — 4,000 characters per message, validated with zod.
- **Context isolation** — every tool receives the workspace id from the
  session, never from the model.
- **No writes without confirmation** — enforced by the pending-action flow.
- **Errors are sanitised** — a provider failure returns a generic message; the
  detail goes to the log with a request id.

## Cost control

Tool results are trimmed before being sent back to the model: lists are
capped, and only the columns relevant to the question are included. This keeps
token usage predictable on large result sets.

## Testing

`tests/unit/` covers the pure helpers the assistant depends on (personalisation
rendering, validation schemas). Tool execution is exercised indirectly through
the service layer, which the integration suite covers when a Supabase project
is configured.
