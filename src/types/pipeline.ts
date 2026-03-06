import { z } from "zod";

// ── Union Types ──────────────────────────────────────────────────────────────

export type PipelineTrigger = "manual" | "webhook" | "schedule";

export type ToolId =
  | "gmail_read"
  | "gmail_send"
  | "gmail_draft"
  | "outlook_read"
  | "outlook_send"
  | "google_calendar_read"
  | "google_calendar_write"
  | "google_calendar_find_slot"
  | "web_search"
  | "web_scrape"
  | "web_research"
  | "supabase_read"
  | "supabase_write"
  | "json_transform"
  | "human_approval_request"
  | "pipeline_notify"
  | "schedule_trigger"
  // HubSpot CRM
  | "hubspot_read_contacts"
  | "hubspot_write_contact"
  | "hubspot_read_companies"
  | "hubspot_write_company"
  | "hubspot_read_deals"
  | "hubspot_write_deal"
  | "hubspot_create_task"
  | "hubspot_create_note"
  | "hubspot_send_email"
  | "hubspot_read_pipeline_stages"
  // Slack
  | "slack_send_message"
  | "slack_send_dm"
  | "slack_post_notification"
  | "slack_request_approval"
  | "slack_create_channel"
  | "slack_read_messages"
  // Google Sheets
  | "sheets_read_rows"
  | "sheets_write_rows"
  | "sheets_update_cells"
  | "sheets_create_spreadsheet"
  | "sheets_search"
  | "sheets_format_cells"
  // Notion
  | "notion_create_page"
  | "notion_read_pages"
  | "notion_update_page"
  | "notion_append_content"
  | "notion_create_standalone_page"
  | "notion_search"
  | "notion_check_exists";

export type AgentArchetype =
  | "Ingestion"
  | "Enrichment"
  | "Validation"
  | "Transformation"
  | "Research"
  | "Analysis"
  | "Scoring"
  | "Classification"
  | "Copywriter"
  | "Outreach"
  | "Summarization"
  | "Report"
  | "Scheduler"
  | "Router"
  | "OrchestratorSub"
  | "QA"
  | "Compliance"
  | "Deduplication"
  | "Logging"
  | "Notification"
  | "Watchdog"
  // Integration Agents
  | "DatabaseWriter"
  | "DatabaseReader"
  | "ContentCreator"
  | "PageCreator"
  | "DataSync"
  | "Notifier"
  | "MessageSender"
  | "CRMWriter"
  | "CRMReader"
  | "Aggregator"
  | "Formatter"
  | "Searcher";

export type OnFailurePolicy =
  | "retry_3x_then_notify"
  | "skip_and_continue"
  | "halt_pipeline"
  | "escalate_to_human";

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface AgentGuardrails {
  max_tokens: number;
  max_runtime_seconds: number;
  temperature: number;
}

export interface DataField {
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description: string;
}

export interface AgentSpec {
  agent_id: string;
  archetype: AgentArchetype;
  role: string;
  system_prompt: string;
  tools: ToolId[];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  requires_approval: boolean;
  approval_message: string | null;
  on_failure: OnFailurePolicy;
  guardrails: AgentGuardrails;
}

export interface FlowEdge {
  from: string;
  to: string;
  condition: string | null;
}

export interface Orchestration {
  flow: FlowEdge[];
  parallel_groups: string[][];
}

export interface ErrorHandling {
  global_fallback: "halt_pipeline" | "notify_human" | "skip_failed_agent";
  retry_policy: "none" | "linear" | "exponential";
  max_retries: number;
  alert_on_failure: boolean;
}

export interface PipelineMeta {
  gaps_filled: string[];
  assumptions: string[];
  recommended_enhancements: string[];
}

export type InputSchema = Record<string, DataField>;

export interface PipelineSpec {
  pipeline_id: string;
  name: string;
  description: string;
  version: number;
  created_at: string;
  triggers: PipelineTrigger[];
  schedule: string | null;
  input_schema: InputSchema;
  agents: AgentSpec[];
  orchestration: Orchestration;
  error_handling: ErrorHandling;
  meta: PipelineMeta;
}

// ── Database Record Types ────────────────────────────────────────────────────

export interface PipelineRecord {
  id: string;
  name: string;
  description: string | null;
  spec: PipelineSpec;
  created_at: string;
  updated_at: string;
}

export type PipelineRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type AgentMessageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_approval";

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: PipelineRunStatus;
  input_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  // Structured error fields
  error_code: string | null;
  error_message: string | null;
  error_user_message: string | null;
  error_action: string | null;
  error_integration: string | null;
  error_details: Record<string, unknown> | null;
}

export interface AgentMessage {
  id: string;
  run_id: string;
  agent_id: string;
  status: AgentMessageStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  // Structured error fields
  error_code: string | null;
  error_user_message: string | null;
  error_action: string | null;
  error_details: Record<string, unknown> | null;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  run_id: string;
  agent_id: string;
  message: string;
  context: Record<string, unknown>;
  status: ApprovalStatus;
  decided_at: string | null;
}

// ── Zod Validation Schema ────────────────────────────────────────────────────

const AgentGuardrailsSchema = z.object({
  max_tokens: z.number().int().positive(),
  max_runtime_seconds: z.number().positive(),
  temperature: z.number().min(0).max(1),
});

const DataFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  required: z.boolean(),
  description: z.string(),
});

const ToolIdSchema = z.enum([
  "gmail_read",
  "gmail_send",
  "gmail_draft",
  "outlook_read",
  "outlook_send",
  "google_calendar_read",
  "google_calendar_write",
  "google_calendar_find_slot",
  "web_search",
  "web_scrape",
  "web_research",
  "supabase_read",
  "supabase_write",
  "json_transform",
  "human_approval_request",
  "pipeline_notify",
  "schedule_trigger",
  // HubSpot CRM
  "hubspot_read_contacts",
  "hubspot_write_contact",
  "hubspot_read_companies",
  "hubspot_write_company",
  "hubspot_read_deals",
  "hubspot_write_deal",
  "hubspot_create_task",
  "hubspot_create_note",
  "hubspot_send_email",
  "hubspot_read_pipeline_stages",
  // Slack
  "slack_send_message",
  "slack_send_dm",
  "slack_post_notification",
  "slack_request_approval",
  "slack_create_channel",
  "slack_read_messages",
  // Google Sheets
  "sheets_read_rows",
  "sheets_write_rows",
  "sheets_update_cells",
  "sheets_create_spreadsheet",
  "sheets_search",
  "sheets_format_cells",
  // Notion
  "notion_create_page",
  "notion_read_pages",
  "notion_update_page",
  "notion_append_content",
  "notion_create_standalone_page",
  "notion_search",
  "notion_check_exists",
]);

const KNOWN_ARCHETYPES = new Set<string>([
  "Ingestion", "Enrichment", "Validation", "Transformation",
  "Research", "Analysis", "Scoring", "Classification",
  "Copywriter", "Outreach", "Summarization", "Report",
  "Scheduler", "Router", "OrchestratorSub", "QA",
  "Compliance", "Deduplication", "Logging", "Notification", "Watchdog",
  // Integration Agents
  "DatabaseWriter", "DatabaseReader", "ContentCreator", "PageCreator",
  "DataSync", "Notifier", "MessageSender", "CRMWriter", "CRMReader",
  "Aggregator", "Formatter", "Searcher",
]);

const AgentArchetypeSchema = z.string().refine(
  (val) => {
    if (!KNOWN_ARCHETYPES.has(val)) {
      console.warn(`[Pipeline Validator] Unknown archetype "${val}" — accepting pipeline spec anyway.`);
    }
    return true;
  }
);

const OnFailurePolicySchema = z.enum([
  "retry_3x_then_notify",
  "skip_and_continue",
  "halt_pipeline",
  "escalate_to_human",
]);

const AgentSpecSchema = z.object({
  agent_id: z.string().min(1),
  archetype: AgentArchetypeSchema,
  role: z.string().min(1),
  system_prompt: z.string().min(1),
  tools: z.array(ToolIdSchema),
  inputs: z.record(z.string(), z.string()),
  outputs: z.record(z.string(), z.string()),
  requires_approval: z.boolean(),
  approval_message: z.string().nullable(),
  on_failure: OnFailurePolicySchema,
  guardrails: AgentGuardrailsSchema,
});

const FlowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  condition: z.string().nullable(),
});

const OrchestrationSchema = z.object({
  flow: z.array(FlowEdgeSchema),
  parallel_groups: z.array(z.array(z.string())),
});

const ErrorHandlingSchema = z.object({
  global_fallback: z.enum([
    "halt_pipeline",
    "notify_human",
    "skip_failed_agent",
  ]),
  retry_policy: z.enum(["none", "linear", "exponential"]),
  max_retries: z.number().int().min(0),
  alert_on_failure: z.boolean(),
});

const PipelineMetaSchema = z.object({
  gaps_filled: z.array(z.string()),
  assumptions: z.array(z.string()),
  recommended_enhancements: z.array(z.string()),
});

const PipelineTriggerSchema = z.enum(["manual", "webhook", "schedule"]);

export const PipelineSpecSchema = z.object({
  pipeline_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  created_at: z.string(),
  triggers: z.array(PipelineTriggerSchema).min(1),
  schedule: z.string().nullable(),
  input_schema: z.record(z.string(), DataFieldSchema),
  agents: z.array(AgentSpecSchema).min(1),
  orchestration: OrchestrationSchema,
  error_handling: ErrorHandlingSchema,
  meta: PipelineMetaSchema,
});
