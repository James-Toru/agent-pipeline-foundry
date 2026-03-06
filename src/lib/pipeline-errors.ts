import type { PipelineSpec } from "@/types/pipeline";
import { isGoogleConfigured } from "@/lib/google-auth";
import { isHubSpotConfigured } from "@/lib/hubspot-auth";
import { isSlackConfigured } from "@/lib/slack-auth";
import { isNotionConfigured } from "@/lib/notion-auth";

// ── Error Code Types ────────────────────────────────────────────────────────

export type PipelineErrorCode =
  // Integration/credential errors
  | "INTEGRATION_NOT_CONFIGURED"
  | "INTEGRATION_AUTH_FAILED"
  | "INTEGRATION_RATE_LIMITED"
  | "INTEGRATION_PERMISSION_DENIED"
  // Agent execution errors
  | "AGENT_TIMEOUT"
  | "AGENT_OUTPUT_INVALID"
  | "AGENT_TOKEN_LIMIT_EXCEEDED"
  // Pipeline configuration errors
  | "PIPELINE_INVALID_INPUT"
  | "PIPELINE_MISSING_INPUT"
  | "PIPELINE_SPEC_INVALID"
  // Tool errors
  | "TOOL_NOT_FOUND"
  | "TOOL_EXECUTION_FAILED"
  // System errors
  | "UNKNOWN_ERROR"
  | "DATABASE_ERROR";

// ── Structured Error Interface ──────────────────────────────────────────────

export interface PipelineError {
  code: PipelineErrorCode;
  message: string;
  user_message: string;
  action: string;
  integration?: string;
  agent_id?: string;
  details?: Record<string, unknown>;
}

// ── Custom Error Class ──────────────────────────────────────────────────────

export class AgentFoundryError extends Error {
  public readonly pipelineError: PipelineError;

  constructor(error: PipelineError) {
    super(error.message);
    this.name = "AgentFoundryError";
    this.pipelineError = error;
  }
}

// ── Integration Name Resolver ───────────────────────────────────────────────

const INTEGRATION_NAMES: Record<string, string> = {
  slack: "Slack",
  gmail: "Gmail",
  google: "Google",
  google_calendar: "Google Calendar",
  google_sheets: "Google Sheets",
  hubspot: "HubSpot",
  notion: "Notion",
  brave_search: "Brave Search",
};

function integrationName(key: string): string {
  return INTEGRATION_NAMES[key] ?? key;
}

// ── Error Factory Functions ─────────────────────────────────────────────────

export const PipelineErrors = {
  integrationNotConfigured(integration: string): PipelineError {
    const name = integrationName(integration);
    return {
      code: "INTEGRATION_NOT_CONFIGURED",
      message: `${name} credentials not configured`,
      user_message: `This pipeline requires ${name} but it is not connected yet.`,
      action: `Go to Settings and connect your ${name} account before running this pipeline.`,
      integration,
      details: { settings_url: "/settings" },
    };
  },

  integrationAuthFailed(
    integration: string,
    originalError: string
  ): PipelineError {
    const name = integrationName(integration);
    return {
      code: "INTEGRATION_AUTH_FAILED",
      message: `${name} authentication failed: ${originalError}`,
      user_message: `Your ${name} credentials are invalid or have expired.`,
      action: `Go to Settings, disconnect ${name}, and reconnect with fresh credentials.`,
      integration,
      details: {
        original_error: originalError,
        settings_url: "/settings",
      },
    };
  },

  integrationRateLimited(integration: string): PipelineError {
    const name = integrationName(integration);
    return {
      code: "INTEGRATION_RATE_LIMITED",
      message: `${name} rate limit exceeded`,
      user_message: `The ${name} API rate limit was reached during this run.`,
      action:
        "Wait a few minutes and run the pipeline again. If this happens frequently, consider reducing the pipeline frequency.",
      integration,
    };
  },

  integrationPermissionDenied(
    integration: string,
    resource: string
  ): PipelineError {
    const name = integrationName(integration);
    return {
      code: "INTEGRATION_PERMISSION_DENIED",
      message: `${name} permission denied for resource: ${resource}`,
      user_message: `Agent Foundry does not have permission to access ${resource} in ${name}.`,
      action:
        integration === "notion"
          ? "Open the page or database in Notion, click \u00b7\u00b7\u00b7 \u2192 Add connections \u2192 Agent Foundry to grant access."
          : `Check that your ${name} credentials have the required permissions and reconnect in Settings.`,
      integration,
      details: { resource, settings_url: "/settings" },
    };
  },

  agentTimeout(
    agentId: string,
    agentRole: string,
    timeoutSeconds: number
  ): PipelineError {
    return {
      code: "AGENT_TIMEOUT",
      message: `Agent ${agentId} timed out after ${timeoutSeconds}s`,
      user_message: `The ${agentRole} agent took too long to complete and was stopped.`,
      action: `Open the pipeline Inspector, click the ${agentRole} agent, and increase the Max Runtime guardrail setting. Then run the pipeline again.`,
      agent_id: agentId,
      details: { timeout_seconds: timeoutSeconds },
    };
  },

  missingInput(fieldName: string): PipelineError {
    return {
      code: "PIPELINE_MISSING_INPUT",
      message: `Required input field missing: ${fieldName}`,
      user_message: `The required field "${fieldName}" was not provided.`,
      action: "Run the pipeline again and make sure all required fields are filled in.",
      details: { field: fieldName },
    };
  },

  toolExecutionFailed(
    toolId: string,
    agentId: string,
    originalError: string
  ): PipelineError {
    return {
      code: "TOOL_EXECUTION_FAILED",
      message: `Tool ${toolId} failed in agent ${agentId}: ${originalError}`,
      user_message: `The ${toolId} tool encountered an error during execution.`,
      action:
        "Check the agent output details below for the specific error. If the issue is credential-related go to Settings.",
      agent_id: agentId,
      details: {
        tool: toolId,
        original_error: originalError,
      },
    };
  },

  unknownError(originalError: string): PipelineError {
    return {
      code: "UNKNOWN_ERROR",
      message: originalError,
      user_message: "An unexpected error occurred during this pipeline run.",
      action:
        "Check the error details below. If the problem persists contact support with the run ID.",
      details: { original_error: originalError },
    };
  },
};

// ── Pre-flight Integration Checker ──────────────────────────────────────────

export function checkRequiredIntegrations(
  spec: PipelineSpec
): PipelineError[] {
  const errors: PipelineError[] = [];
  const allTools = spec.agents.flatMap((a) => a.tools);

  const needsSlack = allTools.some((t) => t.startsWith("slack_"));
  const needsGoogle = allTools.some(
    (t) =>
      t.startsWith("gmail_") ||
      t.startsWith("google_calendar_") ||
      t.startsWith("sheets_")
  );
  const needsHubSpot = allTools.some((t) => t.startsWith("hubspot_"));
  const needsNotion = allTools.some((t) => t.startsWith("notion_"));

  if (needsSlack && !isSlackConfigured()) {
    errors.push(PipelineErrors.integrationNotConfigured("slack"));
  }
  if (needsGoogle && !isGoogleConfigured()) {
    errors.push(PipelineErrors.integrationNotConfigured("gmail"));
  }
  if (needsHubSpot && !isHubSpotConfigured()) {
    errors.push(PipelineErrors.integrationNotConfigured("hubspot"));
  }
  if (needsNotion && !isNotionConfigured()) {
    errors.push(PipelineErrors.integrationNotConfigured("notion"));
  }

  return errors;
}

// ── Integration Detector ────────────────────────────────────────────────────

export function detectIntegrationFromTools(tools: string[]): string {
  if (
    tools.some(
      (t) =>
        t.startsWith("gmail_") ||
        t.startsWith("google_calendar_") ||
        t.startsWith("sheets_")
    )
  )
    return "google";
  if (tools.some((t) => t.startsWith("slack_"))) return "slack";
  if (tools.some((t) => t.startsWith("hubspot_"))) return "hubspot";
  if (tools.some((t) => t.startsWith("notion_"))) return "notion";
  if (tools.some((t) => t.startsWith("web_") || t.startsWith("brave_")))
    return "brave_search";
  return "unknown";
}
