/**
 * Shared request validation (§43).
 *
 * Every schema here is enforced server-side. The client's form validation is a
 * UX affordance only — it is never trusted.
 */

import { z } from "zod";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const keywordSchema = trimmed(1, 120);
export const locationSchema = trimmed(1, 160);

export const searchInputSchema = z
  .object({
    keywords: z.array(keywordSchema).min(1, "Add at least one keyword.").max(20, "Up to 20 keywords."),
    locations: z.array(locationSchema).min(1, "Add at least one location.").max(20, "Up to 20 locations."),
    radius: z.number().int().min(100).max(100_000).nullish(),
    requestedLimit: z.number().int().min(1).max(200_000).default(100),
    language: z.string().trim().min(2).max(12).default("en"),
    minRating: z.number().min(0).max(5).nullish(),
    minReviewCount: z.number().int().min(0).max(1_000_000).nullish(),
    requireWebsite: z.boolean().default(false),
    requirePhone: z.boolean().default(false),
    requireEmail: z.boolean().default(false),
    businessStatus: z.enum(["all", "open", "closed"]).default("all"),
    name: trimmed(1, 120).nullish(),
    extraOptions: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type SearchInput = z.infer<typeof searchInputSchema>;

/** Splits a comma/newline separated free-text field into clean tokens. */
export function parseTokenList(input: string | string[] | undefined | null): string[] {
  const raw = Array.isArray(input) ? input : (input ?? "").split(/[\n,]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw) {
    const value = token.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value.slice(0, 160));
  }
  return out;
}

export const jobActionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel", "retry"]),
});

export const leadFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  emailStatus: z
    .enum(["unknown", "pending", "valid", "invalid", "risky", "accept_all", "disposable", "suppressed"])
    .optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  hasWebsite: z.boolean().optional(),
  minRating: z.number().min(0).max(5).optional(),
  minReviewCount: z.number().int().min(0).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  listId: z.string().uuid().optional(),
  searchId: z.string().uuid().optional(),
  source: z.enum(["google_maps", "manual", "csv_import", "api", "dev_fixture"]).optional(),
  contacted: z.boolean().optional(),
  sort: z
    .enum(["recent", "name", "rating", "reviews", "score", "city"])
    .default("recent"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const bulkLeadActionSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(10_000),
  action: z.enum(["delete", "tag", "untag", "add_to_list", "remove_from_list", "mark_contacted"]),
  tag: z.string().trim().min(1).max(60).optional(),
  listId: z.string().uuid().optional(),
});

export const listInputSchema = z.object({
  name: trimmed(1, 120),
  description: trimmed(0, 500).nullish(),
  color: z.string().trim().max(30).nullish(),
});

export const leadUpdateSchema = z
  .object({
    businessName: trimmed(1, 200).optional(),
    website: z.string().trim().max(500).nullish(),
    phone: z.string().trim().max(60).nullish(),
    email: z.string().trim().max(254).nullish(),
    address: z.string().trim().max(400).nullish(),
    city: z.string().trim().max(120).nullish(),
    state: z.string().trim().max(120).nullish(),
    country: z.string().trim().max(120).nullish(),
    postalCode: z.string().trim().max(30).nullish(),
    category: z.string().trim().max(120).nullish(),
    notes: z.string().max(5_000).nullish(),
    contacted: z.boolean().optional(),
    rating: z.number().min(0).max(5).nullish(),
    reviewCount: z.number().int().min(0).nullish(),
  })
  .strict();

export const exportInputSchema = z.object({
  scope: z.enum(["selected", "filtered", "list", "search", "all"]),
  leadIds: z.array(z.string().uuid()).max(100_000).optional(),
  listId: z.string().uuid().optional(),
  searchId: z.string().uuid().optional(),
  filters: leadFiltersSchema.partial().optional(),
  columns: z.array(z.string().trim().min(1).max(40)).min(1).max(40),
});

export const aiChatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message is required.").max(4_000),
  context: z
    .object({
      leadId: z.string().uuid().optional(),
      listId: z.string().uuid().optional(),
      searchId: z.string().uuid().optional(),
    })
    .default({}),
});

export const billingCheckoutSchema = z.object({
  planCode: z.string().trim().min(1).max(40),
});

export const campaignInputSchema = z.object({
  name: trimmed(1, 160),
  description: trimmed(0, 1_000).nullish(),
  mailboxId: z.string().uuid().nullish(),
  dailyLimit: z.number().int().min(1).max(2_000).default(200),
  stopOnReply: z.boolean().default(true),
  scheduledAt: z.string().datetime().nullish(),
  timezone: z.string().trim().max(64).default("UTC"),
});

export const campaignStepInputSchema = z.object({
  kind: z.enum(["email", "wait", "condition"]).default("email"),
  subject: trimmed(0, 200).nullish(),
  body: z.string().max(20_000).nullish(),
  delayMinutes: z.number().int().min(0).max(60 * 24 * 90).default(0),
  conditions: z.record(z.string(), z.unknown()).default({}),
});

export const mailboxInputSchema = z.object({
  name: trimmed(1, 120),
  email: z.string().email().max(254),
  provider: z.enum(["resend", "smtp"]).default("resend"),
  dailySendLimit: z.number().int().min(1).max(2_000).default(200),
  smtpHost: trimmed(0, 255).nullish(),
  smtpPort: z.number().int().min(1).max(65_535).nullish(),
  smtpUsername: trimmed(0, 255).nullish(),
  smtpPassword: z.string().max(512).nullish(),
});

export const automationInputSchema = z.object({
  name: trimmed(1, 160),
  description: trimmed(0, 1_000).nullish(),
  trigger: z.object({
    type: z.enum(["search_completed", "lead_created", "lead_added_to_list", "campaign_completed"]),
    config: z.record(z.string(), z.unknown()).default({}),
  }),
  conditions: z
    .array(
      z.object({
        field: z.enum([
          "email_status", "has_email", "has_phone", "has_website",
          "rating", "review_count", "city", "category", "lead_score",
        ]),
        operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"]),
        value: z.unknown(),
      }),
    )
    .max(20)
    .default([]),
  actions: z
    .array(
      z.object({
        type: z.enum(["add_to_list", "add_to_campaign", "add_tag", "notify"]),
        params: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(10),
  status: z.enum(["draft", "active", "paused"]).default("draft"),
});

export const profileUpdateSchema = z.object({
  fullName: trimmed(0, 120).nullish(),
  company: trimmed(0, 160).nullish(),
  timezone: z.string().trim().max(64).optional(),
  productEmailOptIn: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
  dataRetentionDays: z.number().int().min(30).max(3_650).optional(),
});
