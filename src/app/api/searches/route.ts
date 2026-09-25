import { NextRequest } from "next/server";
import { z } from "zod";
import { withRoute, readJson, json } from "@/server/api";
import { requireAuthContext } from "@/server/auth";
import { requireRateLimit } from "@/server/rate-limit";
import { createSearch, listSearches } from "@/server/services/searches";
import { recordAudit } from "@/server/services/audit";

const createSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  locations: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
  radius: z.number().int().min(100).max(100_000).nullish(),
  requestedLimit: z.number().int().min(1).max(200_000).default(100),
  language: z.string().trim().min(2).max(12).default("en"),
  minRating: z.number().min(0).max(5).nullish(),
  minReviewCount: z.number().int().min(0).max(1_000_000).nullish(),
  requireWebsite: z.boolean().default(false),
  requirePhone: z.boolean().default(false),
  requireEmail: z.boolean().default(false),
  businessStatus: z.enum(["all", "open", "closed"]).default("all"),
  name: z.string().trim().max(120).nullish(),
  extraOptions: z.record(z.string(), z.unknown()).default({}),
});

/** POST /api/searches — create a scrape job (quota-checked server-side). */
export const POST = withRoute("POST /api/searches", async (request: NextRequest, ctx) => {
  const auth = await requireAuthContext();
  await requireRateLimit("search:create", auth.user.id, ctx);

  const input = await readJson(request, createSchema);
  const result = await createSearch({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    input,
  });

  await recordAudit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.user.id,
    action: "create",
    entityType: "scrape_job",
    entityId: result.job.id,
    requestId: ctx.requestId,
    request,
    metadata: { keywords: input.keywords, locations: input.locations, limit: result.job.requested_limit },
  });

  return json(
    {
      search: result.search,
      job: result.job,
      cappedTo: result.cappedTo,
      remainingAfterCap: result.remainingAfterCap,
    },
    201,
  );
});

/** GET /api/searches — list search history. */
export const GET = withRoute("GET /api/searches", async (request, _ctx) => {
  const auth = await requireAuthContext();
  const url = new URL(request.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 25));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const { searches, total } = await listSearches(auth.workspaceId, { limit, offset });
  return json({ searches, total });
});
