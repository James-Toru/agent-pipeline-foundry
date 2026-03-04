import type { ToolId } from "@/types/pipeline";

// ── MCP Server Configuration ─────────────────────────────────────────────────

export interface MCPServerConfig {
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  tools: ToolId[];
}

export const MCP_SERVER_CONFIGS: MCPServerConfig[] = [
  {
    name: "gmail",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gmail"],
    env: {
      GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ?? "",
      GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ?? "",
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ?? "",
    },
    tools: ["gmail_read", "gmail_send", "gmail_draft"],
  },
  {
    name: "google-calendar",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-calendar"],
    env: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    },
    tools: [
      "google_calendar_read",
      "google_calendar_write",
      "google_calendar_find_slot",
    ],
  },
  {
    name: "brave-search",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY ?? "",
    },
    tools: ["web_search", "web_scrape", "web_research"],
  },
  {
    name: "filesystem",
    transport: "stdio",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      process.env.MCP_FILESYSTEM_PATH ?? "/tmp/agent-foundry",
    ],
    tools: ["json_transform"],
  },
];

/**
 * Returns the MCPServerConfig whose tools array includes the given toolId.
 */
export function getServerForTool(
  toolId: ToolId
): MCPServerConfig | undefined {
  return MCP_SERVER_CONFIGS.find((server) =>
    server.tools.includes(toolId)
  );
}
