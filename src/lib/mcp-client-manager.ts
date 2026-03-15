import { isGoogleConfigured } from "@/lib/google-auth";
import { gmailRead, gmailSend, gmailDraft } from "@/lib/integrations/gmail";
import {
  calendarRead,
  calendarWrite,
  calendarFindSlot,
} from "@/lib/integrations/google-calendar";
import {
  sheetsReadRows,
  sheetsWriteRows,
  sheetsUpdateCells,
  sheetsCreateSpreadsheet,
  sheetsSearch,
  sheetsFormatCells,
} from "@/lib/integrations/google-sheets";
import {
  braveWebSearch,
  braveScrapePage,
  braveWebResearch,
} from "@/lib/integrations/brave-search";
import {
  hubspotReadContacts,
  hubspotWriteContact,
  hubspotReadCompanies,
  hubspotWriteCompany,
  hubspotReadDeals,
  hubspotWriteDeal,
  hubspotCreateTask,
  hubspotCreateNote,
  hubspotSendEmail,
  hubspotReadPipelineStages,
} from "@/lib/integrations/hubspot";
import { isHubSpotConfigured } from "@/lib/hubspot-auth";
import {
  slackSendMessage,
  slackSendDM,
  slackPostNotification,
  slackRequestApproval,
  slackCreateChannel,
  slackReadMessages,
} from "@/lib/integrations/slack";
import { isSlackConfigured } from "@/lib/slack-auth";
import * as Notion from "@/lib/integrations/notion";
import { isNotionConfigured } from "@/lib/notion-auth";
import type { ToolId } from "@/types/pipeline";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToolExecutionResult =
  | { success: true; result: string }
  | { success: false; error: string; fallback: string };

// ── Simulation Fallbacks ──────────────────────────────────────────────────────

function getSimulationFallback(
  toolId: ToolId,
  _input: Record<string, unknown>
): string {
  return (
    `ERROR: Tool "${toolId}" is unavailable. The required service is not configured. ` +
    `Do NOT retry this tool — it will fail again. ` +
    `Proceed with your task using the information you already have, ` +
    `or produce your best output based on your own knowledge.`
  );
}

// ── JSON Transform (local, no external dependency) ────────────────────────────

async function handleJsonTransform(
  input: Record<string, unknown>
): Promise<string> {
  const data = input.input ?? {};
  const ops = Array.isArray(input.operations)
    ? (input.operations as Array<{ type: string; config: Record<string, unknown> }>)
    : [];

  let result: unknown = data;

  for (const op of ops) {
    switch (op.type) {
      case "pick": {
        const keys = op.config.keys as string[];
        if (typeof result === "object" && result !== null && !Array.isArray(result)) {
          const r = result as Record<string, unknown>;
          result = Object.fromEntries(
            keys.filter((k) => k in r).map((k) => [k, r[k]])
          );
        }
        break;
      }
      case "filter": {
        if (Array.isArray(result)) {
          const key = op.config.key as string;
          const value = op.config.value;
          result = result.filter(
            (item: unknown) =>
              typeof item === "object" &&
              item !== null &&
              (item as Record<string, unknown>)[key] === value
          );
        }
        break;
      }
      case "map": {
        if (Array.isArray(result)) {
          const field = op.config.field as string;
          result = result.map(
            (item: unknown) =>
              typeof item === "object" && item !== null
                ? (item as Record<string, unknown>)[field]
                : item
          );
        }
        break;
      }
      default:
        break;
    }
  }

  return JSON.stringify({ status: "success", result });
}

// ── Tool Client Manager ───────────────────────────────────────────────────────

const GOOGLE_TOOL_IDS = new Set<ToolId>([
  "gmail_read",
  "gmail_send",
  "gmail_draft",
  "google_calendar_read",
  "google_calendar_write",
  "google_calendar_find_slot",
  "sheets_read_rows",
  "sheets_write_rows",
  "sheets_update_cells",
  "sheets_create_spreadsheet",
  "sheets_search",
  "sheets_format_cells",
]);

const HUBSPOT_TOOL_IDS = new Set<ToolId>([
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
]);

const SLACK_TOOL_IDS = new Set<ToolId>([
  "slack_send_message",
  "slack_send_dm",
  "slack_post_notification",
  "slack_request_approval",
  "slack_create_channel",
  "slack_read_messages",
]);

export class MCPClientManager {
  /**
   * Validates that required credentials are available for the tool IDs used in
   * this run. Logs warnings for missing credentials so the orchestrator can
   * surface them early. Non-throwing — tools fall back gracefully at call time.
   */
  async startServersForRun(toolIds: ToolId[]): Promise<void> {
    const needsGoogle = toolIds.some((id) => GOOGLE_TOOL_IDS.has(id));
    if (needsGoogle && !isGoogleConfigured()) {
      console.warn(
        "[Tools] Google credentials not fully configured — Gmail/Calendar tools will return errors. " +
          "Configure Google credentials in Settings → Integrations."
      );
    }

    const needsBrave = toolIds.some((id) =>
      (["web_search", "web_scrape", "web_research"] as ToolId[]).includes(id)
    );
    if (needsBrave && !process.env.BRAVE_API_KEY) {
      console.warn(
        "[Tools] BRAVE_API_KEY not set — web search tools will return errors."
      );
    }

    const needsHubSpot = toolIds.some((id) => HUBSPOT_TOOL_IDS.has(id));
    if (needsHubSpot && !isHubSpotConfigured()) {
      console.warn(
        "[Tools] HUBSPOT_ACCESS_TOKEN not set — HubSpot tools will return errors. " +
          "Configure HubSpot credentials in Settings → Integrations."
      );
    }

    const needsSlack = toolIds.some((id) => SLACK_TOOL_IDS.has(id));
    if (needsSlack && !isSlackConfigured()) {
      console.warn(
        "[Tools] SLACK_BOT_TOKEN not set — Slack tools will return errors. " +
          "Configure Slack credentials in Settings → Integrations."
      );
    }

    const NOTION_TOOL_IDS = [
      "notion_create_page",
      "notion_read_pages",
      "notion_update_page",
      "notion_append_content",
      "notion_create_standalone_page",
      "notion_search",
      "notion_check_exists",
    ];
    const needsNotion = toolIds.some((id) => NOTION_TOOL_IDS.includes(id));
    if (needsNotion && !isNotionConfigured()) {
      console.warn(
        "[Tools] NOTION_API_KEY not configured. Notion tools will return errors. " +
          "Configure Notion credentials in Settings → Integrations."
      );
    }

    console.log(
      `[Tools] Direct API integrations ready for ${toolIds.length} tool(s)`
    );
  }

  /**
   * Execute a tool via direct API integration. Returns a structured result
   * that the orchestrator uses to build the tool_result message for the agent.
   */
  async executeTool(
    toolId: ToolId,
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    try {
      let result: string;

      switch (toolId) {
        // ── Gmail ──────────────────────────────────────────────────────────
        case "gmail_read":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await gmailRead(input);
          break;

        case "gmail_send":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await gmailSend(input);
          break;

        case "gmail_draft":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await gmailDraft(input);
          break;

        // ── Google Calendar ────────────────────────────────────────────────
        case "google_calendar_read":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await calendarRead(input);
          break;

        case "google_calendar_write":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await calendarWrite(input);
          break;

        case "google_calendar_find_slot":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await calendarFindSlot(input);
          break;

        // ── Google Sheets ──────────────────────────────────────────────────
        case "sheets_read_rows":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await sheetsReadRows(input);
          break;

        case "sheets_write_rows":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await sheetsWriteRows(input);
          break;

        case "sheets_update_cells":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await sheetsUpdateCells(input);
          break;

        case "sheets_create_spreadsheet":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await sheetsCreateSpreadsheet(input);
          break;

        case "sheets_search":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await sheetsSearch(input);
          break;

        case "sheets_format_cells":
          if (!isGoogleConfigured()) {
            return {
              success: false,
              error: "Google credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          result = await sheetsFormatCells(input);
          break;

        // ── Brave Search ───────────────────────────────────────────────────
        case "web_search":
          result = await braveWebSearch(input);
          break;

        case "web_scrape":
          result = await braveScrapePage(input);
          break;

        case "web_research":
          result = await braveWebResearch(input);
          break;

        // ── JSON Transform (local) ─────────────────────────────────────────
        case "json_transform":
          result = await handleJsonTransform(input);
          break;

        // ── HubSpot CRM ────────────────────────────────────────────────────
        case "hubspot_read_contacts":
          result = await hubspotReadContacts(input);
          break;

        case "hubspot_write_contact":
          result = await hubspotWriteContact(input);
          break;

        case "hubspot_read_companies":
          result = await hubspotReadCompanies(input);
          break;

        case "hubspot_write_company":
          result = await hubspotWriteCompany(input);
          break;

        case "hubspot_read_deals":
          result = await hubspotReadDeals(input);
          break;

        case "hubspot_write_deal":
          result = await hubspotWriteDeal(input);
          break;

        case "hubspot_create_task":
          result = await hubspotCreateTask(input);
          break;

        case "hubspot_create_note":
          result = await hubspotCreateNote(input);
          break;

        case "hubspot_send_email":
          result = await hubspotSendEmail(input);
          break;

        case "hubspot_read_pipeline_stages":
          result = await hubspotReadPipelineStages(input);
          break;

        // ── Slack ──────────────────────────────────────────────────────────
        case "slack_send_message":
          if (!isSlackConfigured()) {
            return {
              success: false,
              error: "Slack credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          return await slackSendMessage(input as Parameters<typeof slackSendMessage>[0]);

        case "slack_send_dm":
          if (!isSlackConfigured()) {
            return {
              success: false,
              error: "Slack credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          return await slackSendDM(input as Parameters<typeof slackSendDM>[0]);

        case "slack_post_notification":
          if (!isSlackConfigured()) {
            return {
              success: false,
              error: "Slack credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          return await slackPostNotification(
            input as Parameters<typeof slackPostNotification>[0]
          );

        case "slack_request_approval":
          if (!isSlackConfigured()) {
            return {
              success: false,
              error: "Slack credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          return await slackRequestApproval(
            input as Parameters<typeof slackRequestApproval>[0]
          );

        case "slack_create_channel":
          if (!isSlackConfigured()) {
            return {
              success: false,
              error: "Slack credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          return await slackCreateChannel(
            input as Parameters<typeof slackCreateChannel>[0]
          );

        case "slack_read_messages":
          if (!isSlackConfigured()) {
            return {
              success: false,
              error: "Slack credentials not configured",
              fallback: getSimulationFallback(toolId, input),
            };
          }
          return await slackReadMessages(
            input as Parameters<typeof slackReadMessages>[0]
          );

        // ── Notion ─────────────────────────────────────────────────────────
        case "notion_create_page":
          return Notion.notionCreatePage(input);

        case "notion_read_pages":
          return Notion.notionReadPages(input);

        case "notion_update_page":
          return Notion.notionUpdatePage(input);

        case "notion_append_content":
          return Notion.notionAppendContent(input);

        case "notion_create_standalone_page":
          return Notion.notionCreateStandalonePage(input);

        case "notion_search":
          return Notion.notionSearch(input);

        case "notion_check_exists":
          return Notion.notionCheckPageExists(input);

        // ── Not implemented ────────────────────────────────────────────────
        case "outlook_read":
        case "outlook_send":
          return {
            success: false,
            error: "Outlook integration is not implemented",
            fallback: getSimulationFallback(toolId, input),
          };

        default:
          return {
            success: false,
            error: `No handler registered for tool "${toolId}"`,
            fallback: getSimulationFallback(toolId, input),
          };
      }

      return { success: true, result };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Tool execution failed";
      console.error(`[Tools] Tool "${toolId}" failed:`, errorMsg);
      return {
        success: false,
        error: errorMsg,
        fallback: getSimulationFallback(toolId, input),
      };
    }
  }

  /**
   * No-op: direct API integrations have no persistent connections to close.
   */
  async shutdown(): Promise<void> {
    console.log("[Tools] Direct API integrations — no shutdown needed");
  }
}

// ── Internal Tools (handled by orchestrator, not this manager) ────────────────

const INTERNAL_TOOLS = new Set<ToolId>([
  "human_approval_request",
  "pipeline_notify",
  "schedule_trigger",
  "supabase_read",
  "supabase_write",
  "execute_code",
]);

export { INTERNAL_TOOLS };
