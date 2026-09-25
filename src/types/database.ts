/**
 * Hand-maintained mirror of the Zybble Postgres schema (see
 * `supabase/migrations`). Regenerate with:
 *
 *   supabase gen types typescript --local > src/types/database.ts
 *
 * Keeping it checked in means `tsc --noEmit` and the test suite can run without
 * a live database, while still giving end-to-end type safety on queries.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ScrapeJobStatus =
  | "queued"
  | "starting"
  | "running"
  | "paused"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired"
  | "incomplete";

export type EmailVerificationStatus =
  | "unknown"
  | "pending"
  | "valid"
  | "invalid"
  | "risky"
  | "accept_all"
  | "disposable"
  | "suppressed";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
export type CampaignLeadStatus =
  | "pending"
  | "scheduled"
  | "sent"
  | "delivered"
  | "opened"
  | "replied"
  | "bounced"
  | "failed"
  | "skipped"
  | "suppressed"
  | "unsubscribed";
export type AutomationStatus = "draft" | "active" | "paused" | "archived";
export type ExportStatus = "queued" | "processing" | "ready" | "failed" | "expired";
export type NotificationType =
  | "search_completed"
  | "search_failed"
  | "subscription_changed"
  | "payment_failed"
  | "payment_succeeded"
  | "campaign_completed"
  | "usage_threshold"
  | "security_event"
  | "system";

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  company: string | null;
  timezone: string;
  marketing_opt_in: boolean;
  product_email_opt_in: boolean;
  data_retention_days: number;
  deletion_requested_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan_id: string | null;
  billing_email: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  currency: string;
  interval: "monthly" | "yearly";
  monthly_leads: number;
  features: Json;
  sort_order: number;
  is_active: boolean;
  razorpay_plan_id: string | null;
  razorpay_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionRow = {
  id: string;
  workspace_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  trial_ends_at: string | null;
  razorpay_customer_id: string | null;
  razorpay_plan_id: string | null;
  razorpay_subscription_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  last_payment_at: string | null;
  last_payment_status: string | null;
  failed_payment_count: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type UsageRow = {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  leads_used: number;
  leads_limit: number;
  searches_run: number;
  exports_run: number;
  ai_requests: number;
  emails_sent: number;
  created_at: string;
  updated_at: string;
}

export type EntitlementRow = {
  workspace_id: string;
  plan_code: string;
  plan_name: string;
  monthly_leads: number;
  leads_used: number;
  leads_remaining: number;
  status: SubscriptionStatus;
  has_email_data: boolean;
  has_phone_data: boolean;
  has_csv_export: boolean;
  has_ai_assistant: boolean;
  has_campaigns: boolean;
  max_seats: number;
  period_start: string | null;
  period_end: string | null;
  cancel_at_period_end: boolean;
  computed_at: string;
  updated_at: string;
}

export type SearchRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  name: string | null;
  keywords: string[];
  locations: string[];
  radius: number | null;
  requested_limit: number;
  language: string | null;
  min_rating: number | null;
  min_review_count: number | null;
  require_website: boolean;
  require_phone: boolean;
  require_email: boolean;
  business_status: string | null;
  extra_options: Json;
  status: ScrapeJobStatus;
  result_count: number;
  error_message: string | null;
  duration_ms: number | null;
  last_job_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScrapeJobRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  search_id: string | null;
  status: ScrapeJobStatus;
  keywords: string[];
  locations: string[];
  radius: number | null;
  requested_limit: number;
  language: string | null;
  min_rating: number | null;
  min_review_count: number | null;
  require_website: boolean;
  require_phone: boolean;
  require_email: boolean;
  business_status: string | null;
  extra_options: Json;
  actual_results: number;
  unique_results: number;
  duplicates: number;
  filtered: number;
  websites_found: number;
  phones_found: number;
  emails_found: number;
  verified_emails: number;
  billable_leads: number;
  errors: number;
  error_message: string | null;
  last_error_code: string | null;
  attempts: number;
  max_attempts: number;
  progress: Json;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  worker_id: string | null;
  claimed_at: string | null;
  heartbeat_at: string | null;
  lease_expires_at: string | null;
  cancel_requested: boolean;
  pause_requested: boolean;
  engine: string;
  engine_version: string | null;
}

export type LeadRow = {
  id: string;
  workspace_id: string;
  source: "google_maps" | "manual" | "csv_import" | "api" | "dev_fixture";
  source_id: string | null;
  source_job_id: string | null;
  search_id: string | null;
  business_name: string;
  category: string | null;
  categories: string[];
  website: string | null;
  maps_url: string | null;
  address: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_phone: string | null;
  primary_email: string | null;
  email_status: EmailVerificationStatus;
  rating: number | null;
  review_count: number | null;
  business_status: string | null;
  opening_hours: Json | null;
  description: string | null;
  social_links: Json;
  logo_url: string | null;
  price_range: string | null;
  plus_code: string | null;
  source_metadata: Json;
  lead_score: number;
  notes: string | null;
  contacted_at: string | null;
  times_seen: number;
  dedupe_key: string;
  is_dev_data: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadEmailRow = {
  id: string;
  lead_id: string;
  workspace_id: string;
  email: string;
  status: EmailVerificationStatus;
  is_primary: boolean;
  source: string;
  verified_at: string | null;
  verification_provider: string | null;
  verification_result: Json | null;
  confidence: number | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadPhoneRow = {
  id: string;
  lead_id: string;
  workspace_id: string;
  e164: string;
  raw: string;
  kind: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export type ListRow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  color: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignRow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  mailbox_id: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  timezone: string | null;
  send_window: Json;
  daily_limit: number;
  stop_on_reply: boolean;
  skip_suppressed: boolean;
  stats: Json;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignStepRow = {
  id: string;
  campaign_id: string;
  workspace_id: string;
  position: number;
  kind: "email" | "wait" | "condition";
  subject: string | null;
  body: string | null;
  delay_minutes: number;
  conditions: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CampaignLeadRow = {
  id: string;
  campaign_id: string;
  lead_id: string;
  workspace_id: string;
  email: string;
  status: CampaignLeadStatus;
  current_step: number;
  next_run_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  failed_at: string | null;
  attempts: number;
  last_error: string | null;
  idempotency_key: string;
  unsubscribe_token: string;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type MailboxRow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  email: string;
  provider: string;
  status: "pending" | "verified" | "rejected" | "disabled";
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  daily_send_limit: number;
  sent_today: number;
  verified_at: string | null;
  last_error: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AutomationRow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  status: AutomationStatus;
  trigger: Json;
  conditions: Json;
  actions: Json;
  runs_count: number;
  last_run_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AiConversationRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  model: string;
  message_count: number;
  context: Json;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  workspace_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls: Json | null;
  tool_results: Json | null;
  provenance: "stored_data" | "model" | "system" | "user";
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  severity: "info" | "success" | "warning" | "error";
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export type ExportRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  kind: "leads" | "list" | "search" | "campaign";
  status: ExportStatus;
  filters: Json;
  columns: string[];
  lead_ids: string[] | null;
  row_count: number;
  file_path: string | null;
  file_size_bytes: number | null;
  download_token: string;
  expires_at: string;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BillingEventRow = {
  id: string;
  workspace_id: string | null;
  subscription_id: string | null;
  provider: string;
  event_type: string;
  provider_event_id: string | null;
  payload: Json;
  signature_valid: boolean;
  status: string;
  error: string | null;
  attempts: number;
  processed_at: string | null;
  created_at: string;
}

export type WorkerRow = {
  id: string;
  worker_id: string;
  hostname: string | null;
  region: string | null;
  version: string | null;
  status: "online" | "draining" | "offline";
  max_concurrency: number;
  last_heartbeat_at: string;
  started_at: string;
  stopped_at: string | null;
  stats: Json;
}

export type ScrapeJobEventRow = {
  id: string;
  job_id: string;
  workspace_id: string;
  event: string;
  status: ScrapeJobStatus | null;
  message: string | null;
  counters: Json | null;
  worker_id: string | null;
  error_code: string | null;
  created_at: string;
}


export type UsageEventRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  metric: string;
  delta: number;
  idempotency_key: string;
  period_start: string;
  lead_id: string | null;
  scrape_job_id: string | null;
  metadata: Json;
  created_at: string;
}

export type LeadTagRow = {
  lead_id: string;
  tag: string;
  created_at: string;
}

export type ListMemberRow = {
  list_id: string;
  lead_id: string;
  added_by: string | null;
  created_at: string;
}

export type SuppressionRow = {
  id: string;
  workspace_id: string;
  email: string;
  reason: string;
  source: string;
  created_at: string;
}

export type EmailEventRow = {
  id: string;
  workspace_id: string | null;
  provider: string;
  provider_event_id: string | null;
  event_type: string;
  email: string | null;
  campaign_id: string | null;
  campaign_lead_id: string | null;
  payload: Json;
  signature_valid: boolean;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

export type AutomationRunRow = {
  id: string;
  automation_id: string;
  workspace_id: string;
  status: "running" | "succeeded" | "failed" | "skipped";
  trigger_event: string;
  idempotency_key: string;
  subject: Json;
  conditions_met: boolean | null;
  actions_run: Json;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export type AuditLogRow = {
  id: string;
  workspace_id: string | null;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  request_id: string | null;
  ip: string | null;
  user_agent: string | null;
  changes: Json | null;
  metadata: Json;
  created_at: string;
}

export type RateLimitRow = {
  scope: string;
  identifier: string;
  window_start: string;
  count: number;
  updated_at: string;
}

/**
 * Table map used by the Supabase client generics.
 *
 * `Relationships` is required by postgrest-js's `GenericTable`; empty arrays are
 * correct here because we never rely on embedded selects for access control —
 * RLS is the authority, and joins are written explicitly.
 */
type TablesDef = {
  profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { id: string; email: string }; Update: Partial<ProfileRow> };
  workspaces: { Row: WorkspaceRow; Insert: Partial<WorkspaceRow> & { name: string; slug: string; owner_id: string }; Update: Partial<WorkspaceRow> };
  workspace_members: { Row: WorkspaceMemberRow; Insert: Partial<WorkspaceMemberRow> & { workspace_id: string; user_id: string }; Update: Partial<WorkspaceMemberRow> };
  plans: { Row: PlanRow; Insert: Partial<PlanRow> & { code: string; name: string }; Update: Partial<PlanRow> };
  subscriptions: { Row: SubscriptionRow; Insert: Partial<SubscriptionRow> & { workspace_id: string }; Update: Partial<SubscriptionRow> };
  usage: { Row: UsageRow; Insert: Partial<UsageRow> & { workspace_id: string; period_start: string; period_end: string }; Update: Partial<UsageRow> };
  usage_events: { Row: UsageEventRow; Insert: Partial<UsageEventRow> & { workspace_id: string; metric: string; delta: number; idempotency_key: string; period_start: string }; Update: Partial<UsageEventRow> };
  entitlements: { Row: EntitlementRow; Insert: Partial<EntitlementRow> & { workspace_id: string }; Update: Partial<EntitlementRow> };
  billing_events: { Row: BillingEventRow; Insert: Partial<BillingEventRow> & { event_type: string }; Update: Partial<BillingEventRow> };
  searches: { Row: SearchRow; Insert: Partial<SearchRow> & { workspace_id: string }; Update: Partial<SearchRow> };
  scrape_jobs: { Row: ScrapeJobRow; Insert: Partial<ScrapeJobRow> & { workspace_id: string; user_id: string }; Update: Partial<ScrapeJobRow> };
  scrape_job_events: { Row: ScrapeJobEventRow; Insert: Partial<ScrapeJobEventRow> & { job_id: string; workspace_id: string; event: string }; Update: Partial<ScrapeJobEventRow> };
  workers: { Row: WorkerRow; Insert: Partial<WorkerRow> & { worker_id: string }; Update: Partial<WorkerRow> };
  leads: { Row: LeadRow; Insert: Partial<LeadRow> & { workspace_id: string; business_name: string; dedupe_key: string }; Update: Partial<LeadRow> };
  lead_emails: { Row: LeadEmailRow; Insert: Partial<LeadEmailRow> & { lead_id: string; workspace_id: string; email: string }; Update: Partial<LeadEmailRow> };
  lead_phones: { Row: LeadPhoneRow; Insert: Partial<LeadPhoneRow> & { lead_id: string; workspace_id: string; e164: string; raw: string }; Update: Partial<LeadPhoneRow> };
  lead_tags: { Row: LeadTagRow; Insert: Partial<LeadTagRow> & { lead_id: string; tag: string }; Update: Partial<LeadTagRow> };
  lists: { Row: ListRow; Insert: Partial<ListRow> & { workspace_id: string; name: string }; Update: Partial<ListRow> };
  list_members: { Row: ListMemberRow; Insert: Partial<ListMemberRow> & { list_id: string; lead_id: string }; Update: Partial<ListMemberRow> };
  campaigns: { Row: CampaignRow; Insert: Partial<CampaignRow> & { workspace_id: string; name: string }; Update: Partial<CampaignRow> };
  campaign_steps: { Row: CampaignStepRow; Insert: Partial<CampaignStepRow> & { campaign_id: string; workspace_id: string; position: number }; Update: Partial<CampaignStepRow> };
  campaign_leads: { Row: CampaignLeadRow; Insert: Partial<CampaignLeadRow> & { campaign_id: string; lead_id: string; workspace_id: string; email: string; idempotency_key: string }; Update: Partial<CampaignLeadRow> };
  mailboxes: { Row: MailboxRow; Insert: Partial<MailboxRow> & { workspace_id: string; name: string; email: string }; Update: Partial<MailboxRow> };
  suppression_entries: { Row: SuppressionRow; Insert: Partial<SuppressionRow> & { workspace_id: string; email: string }; Update: Partial<SuppressionRow> };
  email_events: { Row: EmailEventRow; Insert: Partial<EmailEventRow> & { event_type: string }; Update: Partial<EmailEventRow> };
  automations: { Row: AutomationRow; Insert: Partial<AutomationRow> & { workspace_id: string; name: string }; Update: Partial<AutomationRow> };
  automation_runs: { Row: AutomationRunRow; Insert: Partial<AutomationRunRow> & { automation_id: string; workspace_id: string; trigger_event: string; idempotency_key: string }; Update: Partial<AutomationRunRow> };
  ai_conversations: { Row: AiConversationRow; Insert: Partial<AiConversationRow> & { workspace_id: string; user_id: string }; Update: Partial<AiConversationRow> };
  ai_messages: { Row: AiMessageRow; Insert: Partial<AiMessageRow> & { conversation_id: string; workspace_id: string; role: "user" | "assistant" | "tool" | "system" }; Update: Partial<AiMessageRow> };
  notifications: { Row: NotificationRow; Insert: Partial<NotificationRow> & { workspace_id: string; title: string }; Update: Partial<NotificationRow> };
  audit_logs: { Row: AuditLogRow; Insert: Partial<AuditLogRow> & { action: string; entity_type: string }; Update: Partial<AuditLogRow> };
  exports: { Row: ExportRow; Insert: Partial<ExportRow> & { workspace_id: string }; Update: Partial<ExportRow> };
  rate_limit_buckets: { Row: RateLimitRow; Insert: Partial<RateLimitRow> & { scope: string; identifier: string; window_start: string }; Update: Partial<RateLimitRow> };
};

type FunctionsDef = {
  period_start: { Args: { ts?: string }; Returns: string };
  period_end: { Args: { p_start: string }; Returns: string };
  record_usage: {
    Args: {
      p_workspace: string;
      p_metric: string;
      p_delta: number;
      p_idempotency_key: string;
      p_user_id?: string | null;
      p_lead_id?: string | null;
      p_job_id?: string | null;
      p_metadata?: Json;
    };
    Returns: { counted: boolean; leads_used: number; leads_limit: number; leads_remaining: number }[];
  };
  recompute_entitlements: { Args: { p_workspace: string }; Returns: EntitlementRow[] };
  ensure_usage_row: { Args: { p_workspace: string; p_period: string }; Returns: UsageRow[] };
  claim_scrape_job: {
    Args: { p_worker_id: string; p_lease_seconds?: number; p_engine_version?: string };
    Returns: ScrapeJobRow[];
  };
  heartbeat_scrape_job: { Args: { p_job_id: string; p_worker_id: string; p_lease_seconds?: number }; Returns: boolean };
  requeue_orphaned_jobs: { Args: { p_limit?: number }; Returns: string[] };
  increment_job_counters: { Args: { p_job_id: string; p_deltas: Json }; Returns: ScrapeJobRow[] };
  complete_scrape_job: {
    Args: {
      p_job_id: string;
      p_status: ScrapeJobStatus;
      p_error?: string | null;
      p_error_code?: string | null;
    };
    Returns: ScrapeJobRow[];
  };
  upsert_lead: {
    Args: {
      p_workspace: string;
      p_dedupe_key: string;
      p_payload: Json;
      p_emails?: Json;
      p_phones?: Json;
      p_job_id?: string | null;
      p_search_id?: string | null;
      p_is_dev?: boolean;
    };
    Returns: { lead_id: string; outcome: string; is_new: boolean }[];
  };
  worker_heartbeat: {
    Args: {
      p_worker_id: string;
      p_hostname?: string | null;
      p_region?: string | null;
      p_version?: string | null;
      p_status?: string;
      p_max_concurrency?: number;
      p_stats?: Json;
    };
    Returns: WorkerRow[];
  };
  rate_limit_check: {
    Args: { p_scope: string; p_identifier: string; p_limit: number; p_window_ms: number };
    Returns: { allowed: boolean; remaining: number; reset_at: string; retry_after_ms: number }[];
  };
  is_workspace_member: { Args: { p_workspace: string }; Returns: boolean };
  is_workspace_admin: { Args: { p_workspace: string }; Returns: boolean };
};

export type Database = {
  public: {
    Tables: { [K in keyof TablesDef]: TablesDef[K] & { Relationships: [] } };
    Views: Record<string, never>;
    Functions: FunctionsDef;
    CompositeTypes: Record<string, never>;
  };
}
