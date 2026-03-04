import type { ToolId } from "@/types/pipeline";

// ── Anthropic Tool Format ────────────────────────────────────────────────────

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ── Tool Registry ────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<ToolId, AnthropicTool> = {
  // Communication
  gmail_read: {
    name: "gmail_read",
    description:
      "Read and search emails from a Gmail inbox. Can filter by sender, subject, date range, labels, and read/unread status. Returns structured email objects with sender, subject, body, date, and attachments.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query (e.g. 'from:user@example.com subject:invoice')" },
        max_results: { type: "number", description: "Maximum number of emails to return (default 10)" },
        label: { type: "string", description: "Gmail label to filter by (e.g. 'INBOX', 'SENT')" },
      },
      required: ["query"],
    },
  },
  gmail_send: {
    name: "gmail_send",
    description:
      "Send an email via Gmail. Supports plain text and HTML body, CC, BCC, and reply-to threading.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content (plain text or HTML)" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
        bcc: { type: "string", description: "BCC recipients (comma-separated)" },
        reply_to_message_id: { type: "string", description: "Message ID to reply to (for threading)" },
      },
      required: ["to", "subject", "body"],
    },
  },
  gmail_draft: {
    name: "gmail_draft",
    description:
      "Create a draft email in Gmail without sending it. Useful for human review before sending.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
      },
      required: ["to", "subject", "body"],
    },
  },
  outlook_read: {
    name: "outlook_read",
    description:
      "Read and search emails from an Outlook inbox. Supports OData filter queries for sender, subject, date, and folder filtering.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Outlook search query or OData filter" },
        max_results: { type: "number", description: "Maximum number of emails to return (default 10)" },
        folder: { type: "string", description: "Outlook folder name (default 'Inbox')" },
      },
      required: ["query"],
    },
  },
  outlook_send: {
    name: "outlook_send",
    description:
      "Send an email via Outlook/Microsoft 365. Supports plain text and HTML body, CC, BCC, and attachments.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
        bcc: { type: "string", description: "BCC recipients (comma-separated)" },
      },
      required: ["to", "subject", "body"],
    },
  },

  // Calendar
  google_calendar_read: {
    name: "google_calendar_read",
    description:
      "Read events from Google Calendar. Can filter by date range, calendar ID, and search terms. Returns structured event objects with title, time, attendees, and location.",
    input_schema: {
      type: "object",
      properties: {
        calendar_id: { type: "string", description: "Calendar ID (default 'primary')" },
        time_min: { type: "string", description: "Start of date range (ISO 8601)" },
        time_max: { type: "string", description: "End of date range (ISO 8601)" },
        query: { type: "string", description: "Free-text search query for events" },
        max_results: { type: "number", description: "Maximum number of events to return" },
      },
    },
  },
  google_calendar_write: {
    name: "google_calendar_write",
    description:
      "Create, update, or cancel events on Google Calendar. Supports attendees, location, description, recurrence, and reminders.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update", "cancel"], description: "Action to perform" },
        event_id: { type: "string", description: "Event ID (required for update/cancel)" },
        title: { type: "string", description: "Event title" },
        start: { type: "string", description: "Event start time (ISO 8601)" },
        end: { type: "string", description: "Event end time (ISO 8601)" },
        attendees: { type: "string", description: "Comma-separated attendee email addresses" },
        location: { type: "string", description: "Event location" },
        description: { type: "string", description: "Event description" },
      },
      required: ["action"],
    },
  },
  google_calendar_find_slot: {
    name: "google_calendar_find_slot",
    description:
      "Find available time slots across one or more Google Calendars. Useful for scheduling meetings without conflicts.",
    input_schema: {
      type: "object",
      properties: {
        attendees: { type: "string", description: "Comma-separated email addresses to check availability" },
        duration_minutes: { type: "number", description: "Required meeting duration in minutes" },
        date_range_start: { type: "string", description: "Start of search range (ISO 8601)" },
        date_range_end: { type: "string", description: "End of search range (ISO 8601)" },
        timezone: { type: "string", description: "Timezone for results (e.g. 'America/New_York')" },
      },
      required: ["attendees", "duration_minutes", "date_range_start", "date_range_end"],
    },
  },

  // Search & Research
  web_search: {
    name: "web_search",
    description:
      "Perform a targeted web search and return structured results with titles, URLs, and snippets. Best for factual lookups and finding specific information.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Maximum number of results (default 5)" },
        site: { type: "string", description: "Restrict results to a specific domain" },
      },
      required: ["query"],
    },
  },
  web_scrape: {
    name: "web_scrape",
    description:
      "Extract content from a specific URL. Returns the page text, metadata, and optionally structured data via CSS selectors.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to scrape" },
        selector: { type: "string", description: "CSS selector to extract specific content" },
        format: { type: "string", enum: ["text", "html", "markdown"], description: "Output format (default 'text')" },
      },
      required: ["url"],
    },
  },
  web_research: {
    name: "web_research",
    description:
      "Perform multi-step research by searching, reading multiple sources, cross-referencing findings, and producing a synthesised research summary.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Research topic or question" },
        depth: { type: "string", enum: ["quick", "standard", "deep"], description: "Research depth (default 'standard')" },
        sources_limit: { type: "number", description: "Maximum number of sources to consult" },
      },
      required: ["topic"],
    },
  },

  // Data
  supabase_read: {
    name: "supabase_read",
    description:
      "Query data from a Supabase table. Supports filters, ordering, pagination, and column selection.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name to query" },
        select: { type: "string", description: "Columns to select (default '*')" },
        filters: { type: "object", description: "Key-value pairs for equality filters" },
        order_by: { type: "string", description: "Column to order by" },
        ascending: { type: "boolean", description: "Sort ascending (default true)" },
        limit: { type: "number", description: "Maximum number of rows to return" },
      },
      required: ["table"],
    },
  },
  supabase_write: {
    name: "supabase_write",
    description:
      "Write data to a Supabase table. Supports insert, update, upsert, and delete operations.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name to write to" },
        action: { type: "string", enum: ["insert", "update", "upsert", "delete"], description: "Write action" },
        data: { type: "object", description: "Data to write (object or array of objects)" },
        match: { type: "object", description: "Match criteria for update/delete operations" },
      },
      required: ["table", "action", "data"],
    },
  },
  json_transform: {
    name: "json_transform",
    description:
      "Transform JSON data structures. Supports field mapping, flattening, grouping, filtering, and format conversion.",
    input_schema: {
      type: "object",
      properties: {
        input: { type: "object", description: "Input JSON data to transform" },
        operations: {
          type: "array",
          description: "Array of transformation operations to apply in order",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Operation type (map, filter, flatten, group, pick, omit)" },
              config: { type: "object", description: "Operation-specific configuration" },
            },
          },
        },
      },
      required: ["input", "operations"],
    },
  },

  // Utility
  human_approval_request: {
    name: "human_approval_request",
    description:
      "Pause pipeline execution and request human approval. Creates an approval request in the dashboard with the agent's output for review.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to display to the human reviewer" },
        context: { type: "object", description: "Data context for the reviewer to evaluate" },
        urgency: { type: "string", enum: ["low", "medium", "high"], description: "Urgency level of the approval request" },
      },
      required: ["message", "context"],
    },
  },
  pipeline_notify: {
    name: "pipeline_notify",
    description:
      "Send a notification to the Agent Foundry dashboard. Used for status updates, warnings, and informational messages during pipeline execution.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title" },
        message: { type: "string", description: "Notification message body" },
        level: { type: "string", enum: ["info", "warning", "error", "success"], description: "Notification severity level" },
      },
      required: ["title", "message"],
    },
  },
  schedule_trigger: {
    name: "schedule_trigger",
    description:
      "Set a time-based trigger for pipeline resumption or future execution. Supports cron expressions and one-time schedules.",
    input_schema: {
      type: "object",
      properties: {
        trigger_at: { type: "string", description: "ISO 8601 datetime for one-time trigger" },
        cron: { type: "string", description: "Cron expression for recurring trigger" },
        pipeline_id: { type: "string", description: "Pipeline to trigger" },
        payload: { type: "object", description: "Data to pass to the triggered pipeline run" },
      },
      required: ["pipeline_id"],
    },
  },
};

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns Anthropic-formatted tool definitions for the given tool IDs.
 * Only returns tools that exist in the registry — silently skips unknown IDs.
 */
export function getToolsForAgent(toolIds: ToolId[]): AnthropicTool[] {
  return toolIds
    .filter((id) => id in TOOL_REGISTRY)
    .map((id) => TOOL_REGISTRY[id]);
}
