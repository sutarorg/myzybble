import { NextRequest } from "next/server";
import { withRoute, json } from "@/server/api";
import { unsubscribe } from "@/server/services/campaigns";

/**
 * One-click unsubscribe (§22).
 *
 * The token is per (campaign, lead) and is included in every campaign email.
 * Unsubscribing adds the address to the workspace suppression list, so it is
 * honoured by *all* current and future campaigns — not just this one.
 */

function tokenFrom(request: NextRequest): string | null {
  const url = new URL(request.url);
  return (
    url.searchParams.get("token") ??
    url.searchParams.get("t") ??
    null
  );
}

function render(title: string, body: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} — zybble</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f3ec;color:#0b100e;font-family:Inter,system-ui,sans-serif;padding:24px;">
<div style="max-width:480px;text-align:center;">
  <div style="width:44px;height:44px;margin:0 auto 20px;border-radius:12px;background:linear-gradient(135deg,#d8ff3e,#bfe82a);color:#0b100e;font-weight:700;font-size:22px;line-height:44px;">Z</div>
  <h1 style="margin:0 0 10px;font-size:24px;letter-spacing:-0.02em;">${title}</h1>
  <p style="margin:0;font-size:15px;line-height:1.6;opacity:.7;">${body}</p>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const GET = withRoute("GET /api/unsubscribe", async (request: NextRequest) => {
  const token = tokenFrom(request);
  if (!token) return render("Link not valid", "This unsubscribe link is missing its token.");

  const ok = await unsubscribe(token);
  return ok
    ? render(
        "You're unsubscribed",
        "We've removed you from this sender's campaigns. You won't receive any further emails from them.",
      )
    : render("Link not valid", "This unsubscribe link has expired or was already used.");
});

export const POST = withRoute("POST /api/unsubscribe", async (request: NextRequest) => {
  const token = tokenFrom(request);
  if (!token) return json({ error: { code: "bad_request", message: "Missing token." } }, 400);
  const ok = await unsubscribe(token);
  if (!ok) return json({ error: { code: "not_found", message: "Invalid token." } }, 404);
  return json({ ok: true });
});
