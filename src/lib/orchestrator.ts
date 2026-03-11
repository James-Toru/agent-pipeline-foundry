import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, createAnthropicClient } from "@/lib/ai-config";
import { resolveModel, getModelPricing } from "@/lib/models";
import { getToolsForAgent } from "@/lib/tool-registry";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { MCPClientManager, INTERNAL_TOOLS } from "@/lib/mcp-client-manager";
import { isGoogleConfigured } from "@/lib/google-auth";
import { isHubSpotConfigured } from "@/lib/hubspot-auth";
import { isSlackConfigured, getSlackApprovalChannel } from "@/lib/slack-auth";
import { slackRequestApproval } from "@/lib/integrations/slack";
import { isNotionConfigured } from "@/lib/notion-auth";
import {
  getCustomTools,
  getCustomToolByName,
  executeCustomTool,
  customToolToAnthropicFormat,
} from "@/lib/custom-tool-executor";
import type { CustomTool, CustomIntegration } from "@/types/pipeline";
import { sendErrorAlert, classifySeverity } from "@/lib/error-alerting";
import {
  type PipelineError,
  AgentFoundryError,
  PipelineErrors,
  detectIntegrationFromTools,
} from "@/lib/pipeline-errors";
import type {
  PipelineSpec,
  AgentSpec,
  ToolId,
  OnFailurePolicy,
  PipelineRunStatus,
  AgentMessageStatus,
} from "@/types/pipeline";

type MessageParam = Anthropic.MessageParam;

// ── Types ────────────────────────────────────────────────────────────────────

interface TokenUsageRecord {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string;
}

interface AgentResult {
  agent_id: string;
  status: "completed" | "failed";
  output: Record<string, unknown> | null;
  error: string | null;
  token_usage?: TokenUsageRecord;
}

interface RunContext {
  run_id: string;
  pipeline: PipelineSpec;
  input_data: Record<string, unknown>;
  agent_outputs: Map<string, Record<string, unknown>>;
  mcpManager: MCPClientManager;
  customTools: (CustomTool & { integration: CustomIntegration })[];
}

// ── Token Cost Calculation ──────────────────────────────────────────────────

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(model);
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

// ── Database Helpers ─────────────────────────────────────────────────────────

async function updateRunStatus(
  run_id: string,
  status: PipelineRunStatus,
  completed_at?: string
) {
  const supabase = await createSupabaseServiceClient();
  const update: Record<string, unknown> = { status };
  if (completed_at) update.completed_at = completed_at;
  await supabase.from("pipeline_runs").update(update).eq("id", run_id);
}

async function createAgentMessage(
  run_id: string,
  agent_id: string,
  status: AgentMessageStatus,
  input: Record<string, unknown> | null
) {
  const supabase = await createSupabaseServiceClient();
  const { data } = await supabase
    .from("agent_messages")
    .insert({
      run_id,
      agent_id,
      status,
      input,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  return data?.id as string;
}

async function updateAgentMessage(
  message_id: string,
  update: {
    status: AgentMessageStatus;
    output?: Record<string, unknown> | null;
    error?: string | null;
    completed_at?: string;
  }
) {
  const supabase = await createSupabaseServiceClient();
  await supabase.from("agent_messages").update(update).eq("id", message_id);
}

async function createApprovalRequest(
  run_id: string,
  agent_id: string,
  message: string,
  context: Record<string, unknown>
) {
  const supabase = await createSupabaseServiceClient();
  const { data } = await supabase
    .from("approval_requests")
    .insert({
      run_id,
      agent_id,
      message,
      context,
      status: "pending",
    })
    .select("id")
    .single();
  return data?.id as string;
}

async function waitForApproval(
  approval_id: string,
  timeout_seconds: number
): Promise<"approved" | "rejected" | "timeout"> {
  const deadline = Date.now() + timeout_seconds * 1000;
  const supabase = await createSupabaseServiceClient();

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("approval_requests")
      .select("status")
      .eq("id", approval_id)
      .single();

    if (data?.status === "approved") return "approved";
    if (data?.status === "rejected") return "rejected";

    // Poll every 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return "timeout";
}

async function recordTokenUsage(
  run_id: string,
  agent_id: string,
  usage: TokenUsageRecord
) {
  const supabase = await createSupabaseServiceClient();
  await supabase.from("token_usage").insert({
    run_id,
    agent_id,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: usage.cost_usd,
    model: usage.model,
  });
}

async function updateRunAnalytics(
  run_id: string,
  total_tokens: number,
  total_cost_usd: number,
  duration_ms: number
) {
  const supabase = await createSupabaseServiceClient();
  await supabase
    .from("pipeline_runs")
    .update({ total_tokens, total_cost_usd, duration_ms })
    .eq("id", run_id);
}

// ── Structured Run Failure ───────────────────────────────────────────────────

async function failRun(
  run_id: string,
  error: PipelineError
): Promise<void> {
  const supabase = await createSupabaseServiceClient();
  await supabase
    .from("pipeline_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: error.code,
      error_message: error.message,
      error_user_message: error.user_message,
      error_action: error.action,
      error_integration: error.integration ?? null,
      error_details: error.details ?? null,
    })
    .eq("id", run_id);
}

// ── Internal Tool Handlers ──────────────────────────────────────────────────

async function handleInternalTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: RunContext
): Promise<string> {
  switch (toolName) {
    case "human_approval_request": {
      const approvalId = await createApprovalRequest(
        ctx.run_id,
        "system",
        (input.message as string) ?? "Approval requested",
        (input.context as Record<string, unknown>) ?? {}
      );
      return JSON.stringify({
        status: "approval_requested",
        approval_id: approvalId,
        message: "Approval request created. Pipeline will pause until reviewed.",
      });
    }

    case "pipeline_notify": {
      const supabase = await createSupabaseServiceClient();
      await supabase.from("agent_messages").insert({
        run_id: ctx.run_id,
        agent_id: "system_notification",
        status: "completed",
        input: null,
        output: {
          title: input.title,
          message: input.message,
          level: input.level ?? "info",
        },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
      return JSON.stringify({
        status: "notified",
        message: `Notification sent: ${input.title}`,
      });
    }

    case "schedule_trigger": {
      const supabase = await createSupabaseServiceClient();
      await supabase.from("pipeline_scheduled_triggers").insert({
        pipeline_id: input.pipeline_id,
        cron_expression: (input.cron as string) ?? "0 * * * *",
        input_data: (input.payload as Record<string, unknown>) ?? {},
        is_active: true,
        next_run_at: (input.trigger_at as string) ?? new Date().toISOString(),
      });
      return JSON.stringify({
        status: "scheduled",
        message: `Trigger scheduled for pipeline ${input.pipeline_id}`,
      });
    }

    case "supabase_read": {
      const supabase = await createSupabaseServiceClient();
      const table = input.table as string;
      let query = supabase
        .from(table)
        .select((input.select as string) ?? "*");

      if (input.filters && typeof input.filters === "object") {
        for (const [key, value] of Object.entries(
          input.filters as Record<string, unknown>
        )) {
          query = query.eq(key, value);
        }
      }
      if (input.order_by) {
        query = query.order(input.order_by as string, {
          ascending: (input.ascending as boolean) ?? true,
        });
      }
      if (input.limit) {
        query = query.limit(input.limit as number);
      }

      const { data, error } = await query;
      if (error) {
        return JSON.stringify({ status: "error", error: error.message });
      }
      return JSON.stringify({ status: "success", data, count: data?.length ?? 0 });
    }

    case "supabase_write": {
      const supabase = await createSupabaseServiceClient();
      const table = input.table as string;
      const action = input.action as string;
      const data = input.data as Record<string, unknown>;

      let result;
      switch (action) {
        case "insert":
          result = await supabase.from(table).insert(data).select();
          break;
        case "update":
          if (input.match && typeof input.match === "object") {
            let query = supabase.from(table).update(data);
            for (const [key, value] of Object.entries(
              input.match as Record<string, unknown>
            )) {
              query = query.eq(key, value);
            }
            result = await query.select();
          } else {
            return JSON.stringify({
              status: "error",
              error: "match criteria required for update",
            });
          }
          break;
        case "upsert":
          result = await supabase.from(table).upsert(data).select();
          break;
        case "delete":
          if (input.match && typeof input.match === "object") {
            let query = supabase.from(table).delete();
            for (const [key, value] of Object.entries(
              input.match as Record<string, unknown>
            )) {
              query = query.eq(key, value);
            }
            result = await query.select();
          } else {
            return JSON.stringify({
              status: "error",
              error: "match criteria required for delete",
            });
          }
          break;
        default:
          return JSON.stringify({
            status: "error",
            error: `Unknown action: ${action}`,
          });
      }

      if (result.error) {
        return JSON.stringify({ status: "error", error: result.error.message });
      }
      return JSON.stringify({ status: "success", data: result.data });
    }

    default:
      return JSON.stringify({
        status: "error",
        error: `Unknown internal tool: ${toolName}`,
      });
  }
}

// ── Topological Sort ─────────────────────────────────────────────────────────

function topologicalSort(spec: PipelineSpec): string[][] {
  const agents = new Set(spec.agents.map((a) => a.agent_id));
  const parallelSets = spec.orchestration.parallel_groups.map(
    (g) => new Set(g)
  );

  // Build adjacency from flow edges (excluding START/END)
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of agents) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of spec.orchestration.flow) {
    if (edge.from === "START" || edge.to === "END") continue;
    if (!agents.has(edge.from) || !agents.has(edge.to)) continue;
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Kahn's algorithm producing execution layers
  const layers: string[][] = [];
  let queue = [...agents].filter((id) => inDegree.get(id) === 0);

  while (queue.length > 0) {
    const layer: string[] = [];
    const nextQueue: string[] = [];

    for (const id of queue) {
      layer.push(id);
    }

    for (const id of layer) {
      for (const next of adjacency.get(id) ?? []) {
        inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
        if (inDegree.get(next) === 0) {
          nextQueue.push(next);
        }
      }
    }

    // Split layer into parallel groups and sequential agents
    const parallelInLayer: string[][] = [];
    const sequential: string[] = [];

    for (const id of layer) {
      const pg = parallelSets.find((s) => s.has(id));
      if (pg) {
        const groupIds = layer.filter((lid) => pg.has(lid));
        if (
          !parallelInLayer.some(
            (g) =>
              g.length === groupIds.length &&
              g.every((x) => groupIds.includes(x))
          )
        ) {
          parallelInLayer.push(groupIds);
        }
      } else {
        sequential.push(id);
      }
    }

    for (const id of sequential) {
      if (!parallelInLayer.some((g) => g.includes(id))) {
        layers.push([id]);
      }
    }
    for (const group of parallelInLayer) {
      layers.push(group);
    }

    queue = nextQueue;
  }

  return layers;
}

// ── JSON Extraction Helper ──────────────────────────────────────────────────

function extractJson(text: string): Record<string, unknown> | null {
  // Try direct parse first
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // ignore
  }

  // Try to find the largest {...} block in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // ignore
    }
  }

  return null;
}

// ── Execute Single Agent ─────────────────────────────────────────────────────

async function executeAgent(
  agentSpec: AgentSpec,
  ctx: RunContext
): Promise<AgentResult> {
  // Step 1: Start with the original pipeline input data
  const resolvedInputData: Record<string, unknown> = {
    ...ctx.input_data,
  };

  // Step 2: Merge ALL outputs from every completed upstream agent.
  // This ensures every agent has access to all previous results
  // regardless of how the agentSpec.inputs keys are named.
  for (const [agentId, agentOutput] of ctx.agent_outputs) {
    // Merge output fields directly so agents access them by name,
    // e.g. email_body, subject_line, validation_status
    if (agentOutput && typeof agentOutput === "object") {
      Object.assign(resolvedInputData, agentOutput);
    }
    // Also keep namespaced copy for explicit access,
    // e.g. contact_data_validator.validation_status
    resolvedInputData[agentId] = agentOutput;
  }

  const messageId = await createAgentMessage(
    ctx.run_id,
    agentSpec.agent_id,
    "running",
    resolvedInputData
  );

  try {
    const client = createAnthropicClient();
    const agentModel = resolveModel(
      agentSpec.model,
      ctx.pipeline.model,
      ANTHROPIC_MODEL
    );
    const builtInToolIds = agentSpec.tools.filter(
      (t): t is ToolId => !t.startsWith("custom_")
    );
    const builtInTools = getToolsForAgent(builtInToolIds);

    // Add custom tools assigned to this agent (prefixed with "custom_")
    const agentCustomTools = ctx.customTools.filter((ct) =>
      agentSpec.tools.includes(`custom_${ct.name}`)
    );
    const customToolDefs = agentCustomTools.map((ct) =>
      customToolToAnthropicFormat(ct)
    );
    const tools = [
      ...builtInTools,
      ...customToolDefs,
    ] as Anthropic.Tool[];

    const timeoutMs = agentSpec.guardrails.max_runtime_seconds * 1000;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    let toolCallCount = 0;

    const agentCall = async () => {
      const messages: MessageParam[] = [
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Execute your assigned role completely. " +
              "You MUST use the provided tools to perform real operations. " +
              "Do NOT simulate, describe, or reason about what a tool would return — actually call it. " +
              "Every page ID, message timestamp, and confirmation you include in your output must come from a real tool call result.",
            pipeline_inputs: ctx.input_data,
            upstream_outputs: Object.fromEntries(ctx.agent_outputs),
            all_available_data: resolvedInputData,
            required_output_fields: agentSpec.outputs,
            critical_instruction:
              "After completing all tool calls, return a JSON object with all required output fields " +
              "populated with REAL data from actual tool results — not simulated values. " +
              "Use the actual IDs, URLs, and responses returned by the tools. " +
              "If a tool returns an error, include that error in your output — do not invent a success response. " +
              "Your entire final response must be parseable by JSON.parse().",
          }),
        },
      ];

      let iterations = 0;
      const maxIterations = 10;
      let rateLimitRetries = 0;
      const maxRateLimitRetries = 3;

      while (iterations < maxIterations) {
        iterations++;

        // Throttle API calls to avoid Anthropic rate limits
        if (iterations > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        let response: Anthropic.Message;
        try {
          // Force tool use on first call when agent has tools assigned.
          // Without this, models may hallucinate tool results instead of calling them.
          const toolChoice =
            tools.length > 0 && toolCallCount === 0
              ? { type: "any" as const }
              : undefined;

          // Enhance system prompt based on whether the agent has tools
          const systemPromptAddition =
            tools.length > 0
              ? "\n\nCRITICAL: You MUST call the provided tools to perform real operations. " +
                "Never simulate, invent, or describe what a tool would return. " +
                "If you need data, call the tool. If you need to create something, call the tool. " +
                "Your final response must contain ONLY a JSON object with real data from tool results."
              : "\n\nYou do not have any tools available. Produce your output using the information " +
                "provided in the input data and your own knowledge. " +
                "Your final response must be a JSON object containing all required output fields. " +
                "Do not wrap it in markdown code fences.";

          response = await client.messages.create({
            model: agentModel,
            max_tokens: agentSpec.guardrails.max_tokens,
            temperature: agentSpec.guardrails.temperature,
            system: agentSpec.system_prompt + systemPromptAddition,
            messages,
            ...(tools.length > 0 ? { tools } : {}),
            ...(toolChoice ? { tool_choice: toolChoice } : {}),
          });
          rateLimitRetries = 0; // Reset on success
        } catch (apiErr: unknown) {
          // Handle Anthropic rate limit (429) with backoff
          const status = (apiErr as { status?: number }).status;
          if (status === 429 && rateLimitRetries < maxRateLimitRetries) {
            rateLimitRetries++;
            const retryAfter = Math.min(15000 * rateLimitRetries, 60000);
            console.warn(
              `[Orchestrator] Anthropic rate limited (attempt ${rateLimitRetries}/${maxRateLimitRetries}) — waiting ${retryAfter / 1000}s`
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfter));
            iterations--; // Retry this iteration
            continue;
          }
          throw apiErr;
        }

        // Accumulate token usage from this API call
        if (response.usage) {
          totalInputTokens += response.usage.input_tokens;
          totalOutputTokens += response.usage.output_tokens;
        }

        const toolUseBlocks = response.content.filter(
          (b) => b.type === "tool_use"
        );

        if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
          const textBlock = response.content.find((b) => b.type === "text");
          const rawOutput =
            textBlock && textBlock.type === "text" ? textBlock.text : "";

          let output: Record<string, unknown>;
          const parsed = extractJson(rawOutput);
          if (parsed) {
            output = parsed;
          } else {
            console.warn(
              `[Orchestrator] Agent ${agentSpec.agent_id} returned non-JSON. Wrapping in structured output.`
            );
            output = {};
            for (const fieldName of Object.keys(agentSpec.outputs)) {
              output[fieldName] = rawOutput;
            }
            output["_raw"] = rawOutput;
          }

          return output;
        }

        // Process tool calls via MCP or internal handlers
        const assistantContent: Anthropic.ContentBlock[] = response.content;
        messages.push({ role: "assistant", content: assistantContent });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.type !== "tool_use") continue;

          const toolId = block.name as ToolId;
          const toolInput = (block.input ?? {}) as Record<string, unknown>;
          let resultContent: string;

          toolCallCount++;
          console.log(
            `[Orchestrator] Agent ${agentSpec.agent_id} calling tool: ${toolId}`,
            JSON.stringify(toolInput).substring(0, 300)
          );

          if (INTERNAL_TOOLS.has(toolId)) {
            // Handle internally — bypass MCP
            resultContent = await handleInternalTool(toolId, toolInput, ctx);
          } else if (toolId.startsWith("custom_")) {
            // Execute custom API tool
            const customTool = await getCustomToolByName(toolId);
            if (customTool) {
              const customResult = await executeCustomTool(customTool, toolInput);
              resultContent = customResult.result;
              if (!customResult.success) {
                console.warn(
                  `[Orchestrator] Custom tool "${toolId}" failed: ${customResult.error}`
                );
              }
            } else {
              resultContent = JSON.stringify({
                error: `Custom tool "${toolId}" not found`,
              });
            }
          } else {
            // Execute via MCP client manager
            const mcpResult = await ctx.mcpManager.executeTool(
              toolId,
              toolInput
            );
            if (mcpResult.success) {
              resultContent = mcpResult.result;
            } else {
              console.warn(
                `[Orchestrator] Tool "${toolId}" failed: ${mcpResult.error}`
              );
              resultContent = mcpResult.fallback;
            }
          }

          console.log(
            `[Orchestrator] Tool ${toolId} result:`,
            resultContent.substring(0, 200)
          );

          toolResults.push({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: resultContent,
          });
        }

        messages.push({ role: "user", content: toolResults });
      }

      return { raw_output: "Agent reached maximum tool-call iterations" };
    };

    // Race against timeout
    const result = await Promise.race([
      agentCall(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Agent execution timed out")),
          timeoutMs
        )
      ),
    ]);

    const output = result as Record<string, unknown>;

    // Verify the agent actually called tools when it had tools assigned
    if (tools.length > 0 && toolCallCount === 0) {
      console.error(
        `[Orchestrator] CRITICAL: Agent ${agentSpec.agent_id} had ${tools.length} tools available but called NONE. Output may be hallucinated.`
      );
    } else if (toolCallCount > 0) {
      console.log(
        `[Orchestrator] Agent ${agentSpec.agent_id} completed with ${toolCallCount} real tool call(s)`
      );
    }

    // Build token usage record
    const costUsd = calculateCost(agentModel, totalInputTokens, totalOutputTokens);
    const tokenUsage: TokenUsageRecord = {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cost_usd: costUsd,
      model: agentModel,
    };

    // Record token usage to database
    await recordTokenUsage(ctx.run_id, agentSpec.agent_id, tokenUsage);

    await updateAgentMessage(messageId, {
      status: "completed",
      output,
      completed_at: new Date().toISOString(),
    });

    return {
      agent_id: agentSpec.agent_id,
      status: "completed",
      output,
      error: null,
      token_usage: tokenUsage,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown agent error";
    const errLower = errorMsg.toLowerCase();

    // Classify the error into a structured PipelineError
    let pipelineError: PipelineError;

    if (err instanceof AgentFoundryError) {
      pipelineError = err.pipelineError;
    } else if (
      errLower.includes("timed out") ||
      errLower.includes("timeout")
    ) {
      pipelineError = PipelineErrors.agentTimeout(
        agentSpec.agent_id,
        agentSpec.role,
        agentSpec.guardrails.max_runtime_seconds
      );
    } else if (
      errLower.includes("token") ||
      errLower.includes("auth") ||
      errLower.includes("credentials") ||
      errLower.includes("unauthorized") ||
      errLower.includes("forbidden")
    ) {
      const integration = detectIntegrationFromTools(agentSpec.tools);
      pipelineError = PipelineErrors.integrationAuthFailed(integration, errorMsg);
    } else if (
      errLower.includes("rate limit") ||
      errLower.includes("too many requests") ||
      errorMsg.includes("429")
    ) {
      const integration = detectIntegrationFromTools(agentSpec.tools);
      pipelineError = PipelineErrors.integrationRateLimited(integration);
    } else if (
      errLower.includes("permission") ||
      errLower.includes("not shared") ||
      errLower.includes("access denied") ||
      errLower.includes("restricted")
    ) {
      const integration = detectIntegrationFromTools(agentSpec.tools);
      pipelineError = PipelineErrors.integrationPermissionDenied(
        integration,
        agentSpec.role
      );
    } else {
      pipelineError = PipelineErrors.toolExecutionFailed(
        "unknown",
        agentSpec.agent_id,
        errorMsg
      );
    }

    // Write structured error to agent_messages
    await updateAgentMessage(messageId, {
      status: "failed",
      error: pipelineError.message,
      completed_at: new Date().toISOString(),
    });

    // Write structured error fields separately (new columns)
    const supabase = await createSupabaseServiceClient();
    await supabase
      .from("agent_messages")
      .update({
        error_code: pipelineError.code,
        error_user_message: pipelineError.user_message,
        error_action: pipelineError.action,
        error_details: pipelineError.details ?? null,
      })
      .eq("id", messageId);

    return {
      agent_id: agentSpec.agent_id,
      status: "failed",
      output: null,
      error: pipelineError.message,
    };
  }
}

// ── Approval Gate ────────────────────────────────────────────────────────────

async function handleApprovalGate(
  agentSpec: AgentSpec,
  agentOutput: Record<string, unknown>,
  ctx: RunContext
): Promise<"approved" | "rejected" | "timeout"> {
  const approvalId = await createApprovalRequest(
    ctx.run_id,
    agentSpec.agent_id,
    agentSpec.approval_message ?? `Approval required for ${agentSpec.role}`,
    agentOutput
  );

  // Notify via Slack if configured — humans can approve/reject directly from Slack
  if (isSlackConfigured()) {
    const channel = getSlackApprovalChannel();
    const contextSummary =
      Object.keys(agentOutput).length > 0
        ? "```" + JSON.stringify(agentOutput, null, 2).slice(0, 1500) + "```"
        : "_No output context available._";
    await slackRequestApproval({
      channel,
      approval_id: approvalId,
      title: agentSpec.approval_message ?? `Approval required for ${agentSpec.role}`,
      context: `*Run:* ${ctx.run_id}\n*Agent:* ${agentSpec.role}\n\n${contextSummary}`,
    }).catch((err) =>
      console.error("[Orchestrator] Slack approval notification failed:", err)
    );
  }

  const supabase = await createSupabaseServiceClient();
  await supabase
    .from("agent_messages")
    .update({ status: "awaiting_approval" })
    .eq("run_id", ctx.run_id)
    .eq("agent_id", agentSpec.agent_id)
    .order("started_at", { ascending: false })
    .limit(1);

  await updateRunStatus(ctx.run_id, "paused");

  const timeout = Math.max(agentSpec.guardrails.max_runtime_seconds, 300);
  const decision = await waitForApproval(approvalId, timeout);

  if (decision === "approved") {
    await updateRunStatus(ctx.run_id, "running");
  }

  return decision;
}

// ── Failure Policy ───────────────────────────────────────────────────────────

async function applyFailurePolicy(
  policy: OnFailurePolicy,
  agentSpec: AgentSpec,
  ctx: RunContext,
  attempt: number
): Promise<"retry" | "skip" | "halt" | "escalate"> {
  switch (policy) {
    case "retry_3x_then_notify":
      if (attempt < 3) return "retry";
      await createAgentMessage(ctx.run_id, agentSpec.agent_id, "failed", null);
      return "skip";

    case "skip_and_continue":
      return "skip";

    case "halt_pipeline":
      return "halt";

    case "escalate_to_human": {
      const approvalId = await createApprovalRequest(
        ctx.run_id,
        agentSpec.agent_id,
        `Agent "${agentSpec.role}" failed. Please decide how to proceed.`,
        { error: "Agent execution failed after applying failure policy" }
      );
      await updateRunStatus(ctx.run_id, "paused");
      const timeout = Math.max(agentSpec.guardrails.max_runtime_seconds, 300);
      const decision = await waitForApproval(approvalId, timeout);
      if (decision === "approved") {
        await updateRunStatus(ctx.run_id, "running");
        return "skip";
      }
      return "halt";
    }

    default:
      return "halt";
  }
}

// ── Execute Agent with Retry ─────────────────────────────────────────────────

async function executeAgentWithRetry(
  agentSpec: AgentSpec,
  ctx: RunContext
): Promise<AgentResult> {
  const maxRetries =
    agentSpec.on_failure === "retry_3x_then_notify" ? 3 : 1;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait longer between retries to respect API rate limits
      const delay = Math.min(10000 * Math.pow(2, attempt), 60000);
      console.log(
        `[Orchestrator] Retry ${attempt}/${maxRetries} for "${agentSpec.agent_id}" — waiting ${delay / 1000}s`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const result = await executeAgent(agentSpec, ctx);

    if (result.status === "completed") {
      if (agentSpec.requires_approval && result.output) {
        const decision = await handleApprovalGate(agentSpec, result.output, ctx);
        if (decision === "rejected" || decision === "timeout") {
          return {
            agent_id: agentSpec.agent_id,
            status: "failed",
            output: null,
            error:
              decision === "rejected"
                ? "Approval rejected by human reviewer"
                : "Approval request timed out",
          };
        }
      }

      if (result.output) {
        ctx.agent_outputs.set(agentSpec.agent_id, result.output);
      }

      return result;
    }

    const action = await applyFailurePolicy(
      agentSpec.on_failure,
      agentSpec,
      ctx,
      attempt
    );

    if (action === "retry") continue;
    if (action === "skip") {
      return {
        agent_id: agentSpec.agent_id,
        status: "failed",
        output: null,
        error: `Skipped after failure: ${result.error}`,
      };
    }
    if (action === "halt" || action === "escalate") {
      return result;
    }
  }

  return {
    agent_id: agentSpec.agent_id,
    status: "failed",
    output: null,
    error: "Max retries exhausted",
  };
}

// ── Main: Run Pipeline ───────────────────────────────────────────────────────

export async function runPipeline(
  run_id: string,
  pipeline: PipelineSpec,
  input_data: Record<string, unknown>
): Promise<void> {
  // Collect all tool IDs and start needed MCP servers
  const allToolIds = pipeline.agents.flatMap((a) => a.tools);

  // Fail fast if integrations are required but not configured
  const requiresHubSpot = allToolIds.some((t) => t.startsWith("hubspot_"));
  if (requiresHubSpot && !isHubSpotConfigured()) {
    const error = PipelineErrors.integrationNotConfigured("hubspot");
    await failRun(run_id, error);
    throw new AgentFoundryError(error);
  }

  const requiresSlack = allToolIds.some((t) => t.startsWith("slack_"));
  if (requiresSlack && !isSlackConfigured()) {
    const error = PipelineErrors.integrationNotConfigured("slack");
    await failRun(run_id, error);
    throw new AgentFoundryError(error);
  }

  const requiresGoogle = allToolIds.some(
    (t) =>
      t.startsWith("gmail_") ||
      t.startsWith("google_calendar_") ||
      t.startsWith("sheets_")
  );
  if (requiresGoogle && !isGoogleConfigured()) {
    const integration = allToolIds.some((t) => t.startsWith("sheets_"))
      ? "google_sheets"
      : allToolIds.some((t) => t.startsWith("gmail_"))
        ? "gmail"
        : "google_calendar";
    const error = PipelineErrors.integrationNotConfigured(integration);
    await failRun(run_id, error);
    throw new AgentFoundryError(error);
  }

  const requiresNotion = allToolIds.some((t) => t.startsWith("notion_"));
  if (requiresNotion && !isNotionConfigured()) {
    const error = PipelineErrors.integrationNotConfigured("notion");
    await failRun(run_id, error);
    throw new AgentFoundryError(error);
  }

  const mcpManager = new MCPClientManager();

  // Filter out custom tools — MCP only handles built-in tools
  const builtInToolIds = allToolIds.filter(
    (t): t is ToolId => !t.startsWith("custom_")
  );

  try {
    await mcpManager.startServersForRun(builtInToolIds);
  } catch (err) {
    console.error("[Orchestrator] MCP startup error (continuing with fallbacks):", err);
  }

  // Load custom tools for this run
  let customTools: (CustomTool & { integration: CustomIntegration })[] = [];
  const hasCustomTools = allToolIds.some((t) => t.startsWith("custom_"));
  if (hasCustomTools) {
    customTools = await getCustomTools();
  }

  const ctx: RunContext = {
    run_id,
    pipeline,
    input_data,
    agent_outputs: new Map(),
    mcpManager,
    customTools,
  };

  const startTime = Date.now();
  let runTotalTokens = 0;
  let runTotalCost = 0;

  const supabase = await createSupabaseServiceClient();

  try {
    await updateRunStatus(run_id, "running");

    const agentMap = new Map(pipeline.agents.map((a) => [a.agent_id, a]));
    const layers = topologicalSort(pipeline);

    for (const layer of layers) {
      if (layer.length === 0) continue;

      // Check if the run has been cancelled before starting the next layer
      const { data: runCheck } = await supabase
        .from("pipeline_runs")
        .select("status")
        .eq("id", run_id)
        .single();

      if (runCheck?.status === "cancelled") {
        console.log(`[Orchestrator] Run ${run_id} cancelled by user`);
        const durationMs = Date.now() - startTime;
        await updateRunAnalytics(run_id, runTotalTokens, runTotalCost, durationMs);
        return;
      }

      const agents = layer
        .map((id) => agentMap.get(id))
        .filter((a): a is AgentSpec => a !== undefined);

      if (agents.length === 0) continue;

      if (agents.length === 1) {
        const result = await executeAgentWithRetry(agents[0], ctx);

        if (result.token_usage) {
          runTotalTokens += result.token_usage.input_tokens + result.token_usage.output_tokens;
          runTotalCost += result.token_usage.cost_usd;
        }

        if (result.status === "failed") {
          const severity = classifySeverity(agents[0].on_failure, agents[0].on_failure === "halt_pipeline");
          await sendErrorAlert({
            run_id,
            pipeline_name: pipeline.name,
            agent_id: result.agent_id,
            error_message: result.error ?? "Unknown error",
            severity,
          });

          if (agents[0].on_failure === "halt_pipeline") {
            const durationMs = Date.now() - startTime;
            await updateRunAnalytics(run_id, runTotalTokens, runTotalCost, durationMs);
            const haltError = PipelineErrors.toolExecutionFailed(
              "unknown",
              result.agent_id,
              result.error ?? "Agent failed with halt_pipeline policy"
            );
            await failRun(run_id, haltError);
            return;
          }
        }
      } else {
        const results = await Promise.all(
          agents.map((a) => executeAgentWithRetry(a, ctx))
        );

        for (const result of results) {
          if (result.token_usage) {
            runTotalTokens += result.token_usage.input_tokens + result.token_usage.output_tokens;
            runTotalCost += result.token_usage.cost_usd;
          }
        }

        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "failed") {
            const severity = classifySeverity(agents[i].on_failure, agents[i].on_failure === "halt_pipeline");
            await sendErrorAlert({
              run_id,
              pipeline_name: pipeline.name,
              agent_id: results[i].agent_id,
              error_message: results[i].error ?? "Unknown error",
              severity,
            });

            if (agents[i].on_failure === "halt_pipeline") {
              const durationMs = Date.now() - startTime;
              await updateRunAnalytics(run_id, runTotalTokens, runTotalCost, durationMs);
              const haltError = PipelineErrors.toolExecutionFailed(
                "unknown",
                results[i].agent_id,
                results[i].error ?? "Agent failed with halt_pipeline policy"
              );
              await failRun(run_id, haltError);
              return;
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    await updateRunAnalytics(run_id, runTotalTokens, runTotalCost, durationMs);
    await updateRunStatus(run_id, "completed", new Date().toISOString());
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const pipelineError =
      err instanceof AgentFoundryError
        ? err.pipelineError
        : PipelineErrors.unknownError(errorMsg);

    // Only update if not already failed by failRun()
    const supabase = await createSupabaseServiceClient();
    const { data: currentRun } = await supabase
      .from("pipeline_runs")
      .select("status")
      .eq("id", run_id)
      .single();

    if (currentRun?.status !== "failed") {
      await failRun(run_id, pipelineError);
    }

    console.error(`[Orchestrator] Pipeline run ${run_id} failed:`, errorMsg);
  } finally {
    // Always shut down MCP servers, even on failure
    await mcpManager.shutdown();
  }
}
