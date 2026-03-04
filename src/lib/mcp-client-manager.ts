import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getServerForTool, type MCPServerConfig } from "@/lib/mcp-config";
import type { ToolId } from "@/types/pipeline";

// ── Types ────────────────────────────────────────────────────────────────────

export type ToolExecutionResult =
  | { success: true; result: string }
  | { success: false; error: string; fallback: string };

// ── Tool Name Mapping ────────────────────────────────────────────────────────
// Maps Agent Foundry tool IDs to actual MCP server tool names

const TOOL_NAME_MAP: Record<ToolId, string> = {
  gmail_read: "gmail_search_emails",
  gmail_send: "gmail_send_email",
  gmail_draft: "gmail_create_draft",
  outlook_read: "outlook_read",
  outlook_send: "outlook_send",
  google_calendar_read: "google_calendar_list_events",
  google_calendar_write: "google_calendar_create_event",
  google_calendar_find_slot: "google_calendar_find_free_time",
  web_search: "brave_web_search",
  web_scrape: "brave_fetch_page",
  web_research: "brave_web_search",
  supabase_read: "supabase_read",
  supabase_write: "supabase_write",
  json_transform: "filesystem_write",
  human_approval_request: "human_approval_request",
  pipeline_notify: "pipeline_notify",
  schedule_trigger: "schedule_trigger",
};

// ── Simulation Fallbacks ─────────────────────────────────────────────────────

function getSimulationFallback(
  toolId: ToolId,
  input: Record<string, unknown>
): string {
  return JSON.stringify({
    status: "simulated",
    warning: `MCP server not available for ${toolId}. Using simulation fallback.`,
    data: {
      message: `Simulated result for ${toolId}`,
      input,
    },
  });
}

// ── MCP Client Manager ──────────────────────────────────────────────────────

export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();

  /**
   * Start MCP servers needed for the given tool IDs.
   * Only starts each server once, even if multiple tools need it.
   */
  async startServersForRun(toolIds: ToolId[]): Promise<void> {
    // Identify unique servers needed
    const neededServers = new Map<string, MCPServerConfig>();
    for (const toolId of toolIds) {
      // Skip internally handled tools
      if (INTERNAL_TOOLS.has(toolId)) continue;

      const config = getServerForTool(toolId);
      if (config && !neededServers.has(config.name)) {
        neededServers.set(config.name, config);
      }
    }

    // Start each server
    for (const [name, config] of neededServers) {
      if (this.clients.has(name)) {
        console.log(`[MCP] Server "${name}" already running, skipping`);
        continue;
      }

      try {
        await this.startServer(name, config);
        console.log(`[MCP] Server "${name}" started successfully`);
      } catch (err) {
        console.error(
          `[MCP] Failed to start server "${name}":`,
          err instanceof Error ? err.message : err
        );
        // Do not crash — fall back to simulation for tools on this server
      }
    }

    console.log(
      `[MCP] ${this.clients.size} server(s) active for this run`
    );
  }

  private async startServer(
    name: string,
    config: MCPServerConfig
  ): Promise<void> {
    if (config.transport !== "stdio" || !config.command) {
      throw new Error(
        `Server "${name}" has unsupported transport: ${config.transport}`
      );
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: {
        ...process.env as Record<string, string>,
        ...(config.env ?? {}),
      },
    });

    const client = new Client(
      { name: `agent-foundry-${name}`, version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(name, client);
    this.transports.set(name, transport);
  }

  /**
   * Execute a tool via MCP. Falls back to simulation if the server
   * is not available or the call fails.
   */
  async executeTool(
    toolId: ToolId,
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const config = getServerForTool(toolId);
    if (!config) {
      return {
        success: false,
        error: `No MCP server configured for tool "${toolId}"`,
        fallback: getSimulationFallback(toolId, input),
      };
    }

    const client = this.clients.get(config.name);
    if (!client) {
      console.warn(
        `[MCP] No active client for server "${config.name}", using simulation for "${toolId}"`
      );
      return {
        success: false,
        error: `MCP server "${config.name}" not connected`,
        fallback: getSimulationFallback(toolId, input),
      };
    }

    try {
      const mcpToolName = TOOL_NAME_MAP[toolId] ?? toolId;
      const result = await client.callTool({
        name: mcpToolName,
        arguments: input,
      });

      // Extract text content from MCP response
      const textContent = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n");

      if (!textContent) {
        return {
          success: true,
          result: JSON.stringify({
            status: "success",
            data: result.content,
          }),
        };
      }

      return { success: true, result: textContent };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown MCP error";
      console.error(
        `[MCP] Tool "${toolId}" execution failed on server "${config.name}":`,
        errorMsg
      );
      return {
        success: false,
        error: errorMsg,
        fallback: getSimulationFallback(toolId, input),
      };
    }
  }

  /**
   * Gracefully close all active MCP connections.
   */
  async shutdown(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
        console.log(`[MCP] Server "${name}" disconnected`);
      } catch (err) {
        console.error(
          `[MCP] Error closing server "${name}":`,
          err instanceof Error ? err.message : err
        );
      }
    }
    this.clients.clear();
    this.transports.clear();
    console.log("[MCP] All servers shut down");
  }
}

// ── Internal Tools (handled by orchestrator, not MCP) ────────────────────────

const INTERNAL_TOOLS = new Set<ToolId>([
  "human_approval_request",
  "pipeline_notify",
  "schedule_trigger",
  "supabase_read",
  "supabase_write",
]);

export { INTERNAL_TOOLS };
