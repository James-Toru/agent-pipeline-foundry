import { isGoogleConfigured } from "@/lib/google-auth";
import { gmailRead, gmailSend, gmailDraft } from "@/lib/integrations/gmail";
import {
  calendarRead,
  calendarWrite,
  calendarFindSlot,
} from "@/lib/integrations/google-calendar";
import {
  braveWebSearch,
  braveScrapePage,
  braveWebResearch,
} from "@/lib/integrations/brave-search";
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
          "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.local."
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
]);

export { INTERNAL_TOOLS };
