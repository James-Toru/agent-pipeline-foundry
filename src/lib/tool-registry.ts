import type { ToolId } from "@/types/pipeline";
import { EXECUTE_CODE_TOOL_DEFINITION } from "@/lib/tools/execute-code";

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

  // HubSpot CRM
  hubspot_read_contacts: {
    name: "hubspot_read_contacts",
    description:
      "Search HubSpot CRM for contacts by name, email, company, or any text. Returns contact IDs, names, emails, and key properties for matching records.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search query (name, email, company, etc.)" },
        limit: { type: "number", description: "Maximum contacts to return (default 10)" },
      },
      required: ["query"],
    },
  },
  hubspot_write_contact: {
    name: "hubspot_write_contact",
    description:
      "Create a new contact or update an existing contact in HubSpot CRM. Use action='create' (default) to create, or action='update' with contact_id to update.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update"], description: "Action to perform (default: create)" },
        contact_id: { type: "string", description: "HubSpot contact ID (required for update)" },
        email: { type: "string", description: "Contact email address" },
        first_name: { type: "string", description: "Contact first name" },
        last_name: { type: "string", description: "Contact last name" },
        phone: { type: "string", description: "Phone number" },
        company: { type: "string", description: "Company name" },
        job_title: { type: "string", description: "Job title" },
        lead_status: { type: "string", description: "HubSpot lead status (e.g. NEW, OPEN, IN_PROGRESS)" },
        lifecycle_stage: { type: "string", description: "Lifecycle stage (e.g. lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer)" },
        properties: { type: "object", description: "Key-value properties to update (for update action)" },
      },
    },
  },
  hubspot_read_companies: {
    name: "hubspot_read_companies",
    description:
      "Search HubSpot CRM for companies by name, domain, industry, or any text. Returns company IDs and key properties.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search query (company name, domain, etc.)" },
        limit: { type: "number", description: "Maximum companies to return (default 10)" },
      },
      required: ["query"],
    },
  },
  hubspot_write_company: {
    name: "hubspot_write_company",
    description:
      "Create a new company record in HubSpot CRM. Returns the created company ID and properties.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name (required)" },
        domain: { type: "string", description: "Company website domain (e.g. acme.com)" },
        industry: { type: "string", description: "Industry category" },
        phone: { type: "string", description: "Main phone number" },
        city: { type: "string", description: "City" },
        country: { type: "string", description: "Country" },
        num_employees: { type: "number", description: "Number of employees" },
        annual_revenue: { type: "number", description: "Annual revenue (USD)" },
      },
      required: ["name"],
    },
  },
  hubspot_read_deals: {
    name: "hubspot_read_deals",
    description:
      "Search HubSpot CRM for deals by name, stage, or any text. Returns deal IDs, names, amounts, stages, and key properties.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search query (deal name, stage, etc.)" },
        limit: { type: "number", description: "Maximum deals to return (default 10)" },
      },
      required: ["query"],
    },
  },
  hubspot_write_deal: {
    name: "hubspot_write_deal",
    description:
      "Create a new deal or update an existing deal in HubSpot CRM. Use action='create' (default) to create, or action='update' with deal_id to update.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update"], description: "Action to perform (default: create)" },
        deal_id: { type: "string", description: "HubSpot deal ID (required for update)" },
        deal_name: { type: "string", description: "Deal name" },
        amount: { type: "number", description: "Deal value in USD" },
        stage: { type: "string", description: "Deal stage ID (e.g. appointmentscheduled, qualifiedtobuy, closedwon, closedlost)" },
        close_date: { type: "string", description: "Expected close date (ISO 8601)" },
        pipeline: { type: "string", description: "Pipeline ID (default: 'default')" },
        owner_id: { type: "string", description: "HubSpot owner ID to assign the deal to" },
        contact_id: { type: "string", description: "HubSpot contact ID to associate with this deal" },
        company_id: { type: "string", description: "HubSpot company ID to associate with this deal" },
        properties: { type: "object", description: "Key-value properties to update (for update action)" },
      },
    },
  },
  hubspot_create_task: {
    name: "hubspot_create_task",
    description:
      "Create a follow-up task in HubSpot CRM. Optionally associates the task with a contact.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Task subject / title" },
        body: { type: "string", description: "Task notes or description" },
        due_date: { type: "string", description: "Task due date (ISO 8601)" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], description: "Task priority (default MEDIUM)" },
        status: { type: "string", enum: ["NOT_STARTED", "IN_PROGRESS", "WAITING", "DEFERRED", "COMPLETED"], description: "Task status (default NOT_STARTED)" },
        owner_id: { type: "string", description: "HubSpot owner ID to assign the task to" },
        contact_id: { type: "string", description: "HubSpot contact ID to associate with this task" },
      },
      required: ["subject"],
    },
  },
  hubspot_create_note: {
    name: "hubspot_create_note",
    description:
      "Log a note on a HubSpot CRM record (contact, company, or deal). Useful for capturing meeting notes, call summaries, or research findings.",
    input_schema: {
      type: "object",
      properties: {
        body: { type: "string", description: "Note content (plain text)" },
        owner_id: { type: "string", description: "HubSpot owner ID authoring the note" },
        contact_id: { type: "string", description: "HubSpot contact ID to attach the note to" },
        company_id: { type: "string", description: "HubSpot company ID to attach the note to" },
        deal_id: { type: "string", description: "HubSpot deal ID to attach the note to" },
      },
      required: ["body"],
    },
  },
  hubspot_send_email: {
    name: "hubspot_send_email",
    description:
      "Log an email engagement on a HubSpot contact record. Records the sent email in the CRM timeline.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content (plain text)" },
        direction: { type: "string", enum: ["EMAIL", "INCOMING_EMAIL", "FORWARDED_EMAIL"], description: "Email direction (default EMAIL for outbound)" },
        owner_id: { type: "string", description: "HubSpot owner ID who sent the email" },
        contact_id: { type: "string", description: "HubSpot contact ID to log the email against" },
      },
      required: ["subject", "body"],
    },
  },
  hubspot_read_pipeline_stages: {
    name: "hubspot_read_pipeline_stages",
    description:
      "Read all CRM pipelines and their stage definitions from HubSpot. Returns pipeline IDs, names, and stages with their IDs and labels. Use this to look up valid stage IDs before creating or updating deals.",
    input_schema: {
      type: "object",
      properties: {
        object_type: { type: "string", description: "CRM object type to read pipelines for (default: 'deals')" },
      },
    },
  },

  // Google Sheets
  sheets_read_rows: {
    name: "sheets_read_rows",
    description:
      "Read rows from a Google Sheets spreadsheet. Returns structured data with headers mapped to values. Supports range selection and row limits.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Google Sheets file ID from the URL (docs.google.com/spreadsheets/d/[ID])" },
        sheet_name: { type: "string", description: "Sheet tab name (default: Sheet1)" },
        range: { type: "string", description: "A1 notation range e.g. 'A1:E50' (default: entire sheet)" },
        has_header_row: { type: "boolean", description: "Treat first row as column headers (default: true)" },
        limit: { type: "number", description: "Maximum number of rows to return (default: 100)" },
      },
      required: ["spreadsheet_id"],
    },
  },
  sheets_write_rows: {
    name: "sheets_write_rows",
    description:
      "Write or append rows to a Google Sheets spreadsheet from structured data objects.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Google Sheets file ID" },
        rows: { type: "array", description: "Array of objects to write, each object is one row" },
        sheet_name: { type: "string", description: "Sheet tab name (default: Sheet1)" },
        mode: { type: "string", enum: ["append", "overwrite"], description: "Write mode (default: append)" },
        start_row: { type: "number", description: "Starting row number for overwrite mode (default: 2)" },
        include_headers: { type: "boolean", description: "Write column headers as first row (default: false)" },
      },
      required: ["spreadsheet_id", "rows"],
    },
  },
  sheets_update_cells: {
    name: "sheets_update_cells",
    description:
      "Update specific cells in a Google Sheets spreadsheet using A1 notation. Supports multiple cell ranges in a single call.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Google Sheets file ID" },
        updates: {
          type: "array",
          description: "Array of cell update objects, each with a range and value",
          items: {
            type: "object",
            properties: {
              range: { type: "string", description: "A1 notation e.g. 'B5' or 'B5:D7'" },
              value: { description: "Value to write (string, number, or boolean)" },
            },
          },
        },
        sheet_name: { type: "string", description: "Sheet tab name (default: Sheet1)" },
      },
      required: ["spreadsheet_id", "updates"],
    },
  },
  sheets_create_spreadsheet: {
    name: "sheets_create_spreadsheet",
    description:
      "Create a new Google Sheets spreadsheet with optional tabs, column headers, and sharing settings.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Spreadsheet title" },
        sheets: { type: "array", description: "Array of sheet/tab names to create (default: ['Sheet1'])", items: { type: "string" } },
        headers: { type: "object", description: "Map of sheet name to array of column header strings e.g. { 'Leads': ['Name', 'Email', 'Score'] }" },
        share_with: { type: "array", description: "Email addresses to share the spreadsheet with (viewer access)", items: { type: "string" } },
      },
      required: ["title"],
    },
  },
  sheets_search: {
    name: "sheets_search",
    description:
      "Search for rows in a Google Sheet where a specific column matches a value. Supports exact, contains, and starts_with matching.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Google Sheets file ID" },
        search_column: { type: "string", description: "Column header name to search within" },
        search_value: { type: "string", description: "Value to search for" },
        sheet_name: { type: "string", description: "Sheet tab name (default: Sheet1)" },
        match_type: { type: "string", enum: ["exact", "contains", "starts_with"], description: "Match type (default: contains)" },
        return_columns: { type: "array", description: "Columns to include in results (default: all)", items: { type: "string" } },
      },
      required: ["spreadsheet_id", "search_column", "search_value"],
    },
  },
  sheets_format_cells: {
    name: "sheets_format_cells",
    description:
      "Apply formatting to a range of cells in a Google Sheet including bold, colors, alignment, and number formats.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Google Sheets file ID" },
        range: { type: "string", description: "A1 notation range e.g. 'A1:E1' or 'B5'" },
        format: {
          type: "object",
          description: "Formatting options to apply",
          properties: {
            bold: { type: "boolean" },
            italic: { type: "boolean" },
            font_size: { type: "number" },
            text_color: { type: "string", description: "Hex color e.g. '#FF0000'" },
            background_color: { type: "string", description: "Hex color e.g. '#FFFF00'" },
            horizontal_alignment: { type: "string", enum: ["LEFT", "CENTER", "RIGHT"] },
            number_format: { type: "string", enum: ["TEXT", "NUMBER", "CURRENCY", "DATE", "PERCENT"] },
          },
        },
        sheet_name: { type: "string", description: "Sheet tab name (default: Sheet1)" },
      },
      required: ["spreadsheet_id", "range", "format"],
    },
  },

  // Slack
  slack_send_message: {
    name: "slack_send_message",
    description:
      "Post a message to a Slack channel. Supports plain text and optional thread replies.",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel name (e.g. #general) or channel ID" },
        text: { type: "string", description: "Message text to post" },
        thread_ts: { type: "string", description: "Thread timestamp to reply in a thread (optional)" },
      },
      required: ["channel", "text"],
    },
  },
  slack_send_dm: {
    name: "slack_send_dm",
    description:
      "Send a direct message to a Slack user by their user ID.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Slack user ID (e.g. U01234567)" },
        text: { type: "string", description: "Message text to send" },
      },
      required: ["user_id", "text"],
    },
  },
  slack_post_notification: {
    name: "slack_post_notification",
    description:
      "Post a formatted notification with a title and body to a Slack channel. Supports color-coded attachments (good/warning/danger).",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel name or ID" },
        title: { type: "string", description: "Notification title (shown as main message text)" },
        body: { type: "string", description: "Notification body text (shown as attachment)" },
        color: { type: "string", enum: ["good", "warning", "danger"], description: "Attachment color (default: good)" },
      },
      required: ["channel", "title", "body"],
    },
  },
  slack_request_approval: {
    name: "slack_request_approval",
    description:
      "Post an approval request to a Slack channel with Approve/Reject buttons. The pipeline will pause until a decision is made.",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel name or ID to post the approval request" },
        approval_id: { type: "string", description: "UUID of the approval_request record in the database" },
        title: { type: "string", description: "Short description of what needs approval" },
        context: { type: "string", description: "Detailed context for the reviewer (Markdown supported)" },
      },
      required: ["channel", "approval_id", "title", "context"],
    },
  },
  slack_create_channel: {
    name: "slack_create_channel",
    description:
      "Create a new Slack channel. Channel names are automatically lowercased and spaces replaced with hyphens.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Channel name (will be lowercased and slugified)" },
        is_private: { type: "boolean", description: "Whether to create a private channel (default: false)" },
      },
      required: ["name"],
    },
  },
  slack_read_messages: {
    name: "slack_read_messages",
    description:
      "Read recent messages from a Slack channel. Returns message timestamps, user IDs, and text content.",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel name or ID to read messages from" },
        limit: { type: "number", description: "Maximum number of messages to return (default 10)" },
      },
      required: ["channel"],
    },
  },

  // ============================================
  // NOTION TOOLS
  // ============================================
  notion_create_page: {
    name: "notion_create_page",
    description:
      "Create a new page in a Notion database with properties and optional content. Properties are key-value pairs that match the database schema. Content supports markdown-like formatting (# headings, - bullets, 1. numbered lists).",
    input_schema: {
      type: "object",
      properties: {
        database_id: {
          type: "string",
          description:
            "Notion database ID — found in the database URL after the workspace name (notion.so/workspace/[DATABASE_ID]?v=...)",
        },
        properties: {
          type: "object",
          description:
            "Key-value pairs matching the database schema. String values become rich_text. ISO dates (YYYY-MM-DD) become date fields. Booleans become checkboxes. Numbers become number fields. The title/name field is required.",
        },
        content: {
          type: "string",
          description:
            "Optional page body content in markdown-like format. Supports # heading1, ## heading2, - bullets, 1. numbered lists, plain paragraphs.",
        },
        icon: {
          type: "string",
          description: "Optional single emoji to use as the page icon",
        },
      },
      required: ["database_id", "properties"],
    },
  },
  notion_read_pages: {
    name: "notion_read_pages",
    description:
      "Read and query pages from a Notion database with optional filtering and sorting. Returns structured page data with all properties extracted as readable strings.",
    input_schema: {
      type: "object",
      properties: {
        database_id: {
          type: "string",
          description: "Notion database ID to query",
        },
        filter: {
          type: "object",
          description:
            "Optional filter: { property: string, value: string, type: 'title'|'rich_text'|'select'|'checkbox'|'number' }",
        },
        sort_by: {
          type: "string",
          description: "Property name to sort results by",
        },
        sort_direction: {
          type: "string",
          description: "Sort direction: 'ascending' or 'descending' (default: descending)",
        },
        limit: {
          type: "number",
          description: "Maximum pages to return (default 10, max 50)",
        },
      },
      required: ["database_id"],
    },
  },
  notion_update_page: {
    name: "notion_update_page",
    description:
      "Update properties, icon, or archive status of a Notion page. Only provided properties are updated — existing properties not listed are preserved.",
    input_schema: {
      type: "object",
      properties: {
        page_id: {
          type: "string",
          description: "Notion page ID to update",
        },
        properties: {
          type: "object",
          description: "Properties to update as key-value pairs",
        },
        icon: {
          type: "string",
          description: "New emoji icon for the page",
        },
        archived: {
          type: "boolean",
          description: "Set to true to archive (delete) the page",
        },
      },
      required: ["page_id"],
    },
  },
  notion_append_content: {
    name: "notion_append_content",
    description:
      "Append content blocks to an existing Notion page. Supports markdown-like formatting for headings, bullets, numbered lists, and paragraphs. Automatically batches requests for content over 100 blocks.",
    input_schema: {
      type: "object",
      properties: {
        page_id: {
          type: "string",
          description: "Notion page ID to append content to",
        },
        content: {
          type: "string",
          description:
            "Content to append in markdown-like format. Supports # h1, ## h2, ### h3, - bullets, 1. numbered, plain paragraphs.",
        },
        add_divider: {
          type: "boolean",
          description:
            "Add a horizontal divider line before the new content (default: false)",
        },
      },
      required: ["page_id", "content"],
    },
  },
  notion_create_standalone_page: {
    name: "notion_create_standalone_page",
    description:
      "Create a standalone Notion page inside a parent page. Unlike database pages, standalone pages have a title and free-form content blocks but no database schema properties.",
    input_schema: {
      type: "object",
      properties: {
        parent_page_id: {
          type: "string",
          description: "ID of the parent page that will contain the new page",
        },
        title: {
          type: "string",
          description: "Title for the new page",
        },
        content: {
          type: "string",
          description: "Optional page body in markdown-like format",
        },
        icon: {
          type: "string",
          description: "Optional emoji icon for the page",
        },
      },
      required: ["parent_page_id", "title"],
    },
  },
  notion_search: {
    name: "notion_search",
    description:
      "Search across the entire Notion workspace for pages and databases matching a query string. Returns only results whose title actually matches the query. For checking if a specific record exists in a database, prefer notion_check_exists instead.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term to look for across page titles and content",
        },
        filter_type: {
          type: "string",
          description:
            "Restrict results to 'page' or 'database'. Omit to search both.",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default 10, max 20)",
        },
      },
      required: ["query"],
    },
  },
  notion_check_exists: {
    name: "notion_check_exists",
    description:
      "Check if a specific contact or record already exists in a Notion database by doing an exact title match. Returns exists: true/false and the page_id if found. Use this instead of notion_search when you need to check for a specific record before creating it.",
    input_schema: {
      type: "object",
      properties: {
        database_id: {
          type: "string",
          description: "The Notion database ID to search",
        },
        contact_name: {
          type: "string",
          description: "The exact name to search for",
        },
        title_property: {
          type: "string",
          description:
            'The name of the title property in the database. Default is "Name".',
        },
      },
      required: ["database_id", "contact_name"],
    },
  },

  // Code Execution
  execute_code: EXECUTE_CODE_TOOL_DEFINITION,

  // Context Management
  retrieve_context: {
    name: "retrieve_context",
    description:
      "Retrieve the full, uncompressed output from a previous agent in the pipeline. " +
      "Use this when the context summary provided is insufficient and you need the complete raw data. " +
      "Specify the agent_id of the upstream agent whose full output you need.",
    input_schema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "The agent_id of the upstream agent whose full output you need",
        },
        context_key: {
          type: "string",
          description: "Optional: a specific key within the agent's output to retrieve",
        },
      },
      required: ["agent_id"],
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
