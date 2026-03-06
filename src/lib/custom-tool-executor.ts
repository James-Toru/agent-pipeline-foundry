import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  CustomIntegration,
  CustomTool,
  AuthConfig,
  ToolParameters,
} from "@/types/pipeline";

// ── Cache ───────────────────────────────────────────────────────────────────

let cachedTools: (CustomTool & { integration: CustomIntegration })[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

// ── Fetch custom tools from database ────────────────────────────────────────

export async function getCustomTools(): Promise<
  (CustomTool & { integration: CustomIntegration })[]
> {
  if (cachedTools && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedTools;
  }

  const supabase = await createSupabaseServerClient();

  const { data: integrations, error: intErr } = await supabase
    .from("custom_integrations")
    .select("*")
    .eq("is_active", true);

  if (intErr || !integrations || integrations.length === 0) {
    cachedTools = [];
    cacheTimestamp = Date.now();
    return [];
  }

  const integrationIds = integrations.map((i: CustomIntegration) => i.id);

  const { data: tools, error: toolErr } = await supabase
    .from("custom_tools")
    .select("*")
    .in("integration_id", integrationIds);

  if (toolErr || !tools) {
    cachedTools = [];
    cacheTimestamp = Date.now();
    return [];
  }

  const integrationMap = new Map(
    integrations.map((i: CustomIntegration) => [i.id, i])
  );

  cachedTools = tools.map((t: CustomTool) => ({
    ...t,
    integration: integrationMap.get(t.integration_id)!,
  }));
  cacheTimestamp = Date.now();
  return cachedTools;
}

export async function getCustomToolByName(
  toolName: string
): Promise<(CustomTool & { integration: CustomIntegration }) | null> {
  const tools = await getCustomTools();
  return tools.find((t) => `custom_${t.name}` === toolName) ?? null;
}

export function invalidateCustomToolCache(): void {
  cachedTools = null;
  cacheTimestamp = 0;
}

// ── Auth header builder ─────────────────────────────────────────────────────

function buildAuthHeaders(authConfig: AuthConfig): Record<string, string> {
  switch (authConfig.type) {
    case "api_key":
      if (authConfig.in === "header") {
        return { [authConfig.key_name]: authConfig.key_value };
      }
      return {};

    case "bearer_token":
      return { Authorization: `Bearer ${authConfig.token}` };

    case "basic_auth": {
      const encoded = Buffer.from(
        `${authConfig.username}:${authConfig.password}`
      ).toString("base64");
      return { Authorization: `Basic ${encoded}` };
    }

    case "oauth2":
      if (authConfig.access_token) {
        return { Authorization: `Bearer ${authConfig.access_token}` };
      }
      return {};

    case "custom_header":
      return { [authConfig.header_name]: authConfig.header_value };

    case "none":
    default:
      return {};
  }
}

// ── URL builder ─────────────────────────────────────────────────────────────

function buildUrl(
  baseUrl: string,
  path: string,
  parameters: ToolParameters,
  input: Record<string, unknown>,
  authConfig: AuthConfig
): string {
  // Replace path parameters like {id}
  let resolvedPath = path;
  for (const param of parameters.path) {
    const value = input[param.name];
    if (value !== undefined) {
      resolvedPath = resolvedPath.replace(`{${param.name}}`, String(value));
    }
  }

  const url = new URL(resolvedPath, baseUrl);

  // Add query parameters
  for (const param of parameters.query) {
    const value = input[param.name];
    if (value !== undefined) {
      url.searchParams.set(param.name, String(value));
    }
  }

  // API key in query string
  if (authConfig.type === "api_key" && authConfig.in === "query") {
    url.searchParams.set(authConfig.key_name, authConfig.key_value);
  }

  return url.toString();
}

// ── Build request body ──────────────────────────────────────────────────────

function buildBody(
  parameters: ToolParameters,
  input: Record<string, unknown>
): Record<string, unknown> | null {
  if (parameters.body.length === 0) return null;

  const body: Record<string, unknown> = {};
  for (const param of parameters.body) {
    const value = input[param.name];
    if (value !== undefined) {
      body[param.name] = value;
    } else if (param.default !== undefined) {
      body[param.name] = param.default;
    }
  }
  return body;
}

// ── OAuth2 token refresh ────────────────────────────────────────────────────

async function refreshOAuth2Token(
  integration: CustomIntegration
): Promise<string | null> {
  const config = integration.auth_config;
  if (config.type !== "oauth2" || !config.refresh_token) return null;

  try {
    const res = await fetch(config.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.client_id,
        client_secret: config.client_secret,
        refresh_token: config.refresh_token,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const newToken = data.access_token as string;

    // Persist the new token
    const supabase = await createSupabaseServerClient();
    const updatedConfig = { ...config, access_token: newToken };
    if (data.refresh_token) {
      updatedConfig.refresh_token = data.refresh_token;
    }
    await supabase
      .from("custom_integrations")
      .update({ auth_config: updatedConfig })
      .eq("id", integration.id);

    invalidateCustomToolCache();
    return newToken;
  } catch {
    return null;
  }
}

// ── Execute custom tool ─────────────────────────────────────────────────────

export async function executeCustomTool(
  tool: CustomTool & { integration: CustomIntegration },
  input: Record<string, unknown>
): Promise<{ success: boolean; result: string; error?: string }> {
  const { integration } = tool;
  const params = tool.parameters as ToolParameters;

  try {
    const url = buildUrl(
      integration.base_url,
      tool.path,
      params,
      input,
      integration.auth_config
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...integration.headers,
      ...buildAuthHeaders(integration.auth_config),
    };

    const body = buildBody(params, input);

    const fetchOptions: RequestInit = {
      method: tool.method,
      headers,
    };

    if (body && tool.method !== "GET" && tool.method !== "DELETE") {
      const wrapper = integration.body_wrapper;
      const bodyToSend = wrapper ? { [wrapper]: body } : body;
      fetchOptions.body = JSON.stringify(bodyToSend);
    }

    let res = await fetch(url, fetchOptions);

    // Retry with refreshed OAuth2 token on 401
    if (res.status === 401 && integration.auth_config.type === "oauth2") {
      const newToken = await refreshOAuth2Token(integration);
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, { ...fetchOptions, headers });
      }
    }

    const responseText = await res.text();

    if (!res.ok) {
      return {
        success: false,
        result: responseText,
        error: `HTTP ${res.status}: ${responseText.substring(0, 500)}`,
      };
    }

    // Apply response mapping if defined
    if (
      tool.response_mapping &&
      Object.keys(tool.response_mapping).length > 0
    ) {
      try {
        const responseJson = JSON.parse(responseText);
        const mapped: Record<string, unknown> = {};
        for (const [outputKey, jsonPath] of Object.entries(
          tool.response_mapping
        )) {
          mapped[outputKey] = getNestedValue(responseJson, jsonPath);
        }
        return { success: true, result: JSON.stringify(mapped) };
      } catch {
        return { success: true, result: responseText };
      }
    }

    return { success: true, result: responseText };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      result: JSON.stringify({ error: message }),
      error: message,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

// ── Convert custom tools to Anthropic tool format ───────────────────────────

export function customToolToAnthropicFormat(
  tool: CustomTool
): {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[] };
} {
  const params = tool.parameters as ToolParameters;
  const allParams = [...params.path, ...params.query, ...params.body];

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of allParams) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
    };
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    name: `custom_${tool.name}`,
    description: tool.description,
    input_schema: {
      type: "object",
      properties,
      required,
    },
  };
}
