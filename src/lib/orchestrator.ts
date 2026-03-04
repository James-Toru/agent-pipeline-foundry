import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, createAnthropicClient } from "@/lib/ai-config";
import { getToolsForAgent } from "@/lib/tool-registry";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MCPClientManager, INTERNAL_TOOLS } from "@/lib/mcp-client-manager";
import { sendErrorAlert, classifySeverity } from "@/lib/error-alerting";
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
}

// ── Token Cost Calculation ──────────────────────────────────────────────────

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Pricing per million tokens (USD)
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-sonnet-4-5-latest": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "claude-opus-4-6": { input: 15, output: 75 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 3, output: 15 };
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  await supabase.from("agent_messages").update(update).eq("id", message_id);
}

async function createApprovalRequest(
  run_id: string,
  agent_id: string,
  message: string,
  context: Record<string, unknown>
) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();

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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("pipeline_runs")
    .update({ total_tokens, total_cost_usd, duration_ms })
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
      const supabase = await createSupabaseServerClient();
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
      const supabase = await createSupabaseServerClient();
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
      const supabase = await createSupabaseServerClient();
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
      const supabase = await createSupabaseServerClient();
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

// ── Execute Single Agent ─────────────────────────────────────────────────────

async function executeAgent(
  agentSpec: AgentSpec,
  ctx: RunContext
): Promise<AgentResult> {
  // Collect inputs from upstream agent outputs
  const agentInput: Record<string, unknown> = {};
  for (const key of Object.keys(agentSpec.inputs)) {
    for (const [, outputs] of ctx.agent_outputs) {
      if (key in outputs) {
        agentInput[key] = outputs[key];
      }
    }
    if (key in ctx.input_data && !(key in agentInput)) {
      agentInput[key] = ctx.input_data[key];
    }
  }

  const messageId = await createAgentMessage(
    ctx.run_id,
    agentSpec.agent_id,
    "running",
    agentInput
  );

  try {
    const client = createAnthropicClient();
    const tools = getToolsForAgent(agentSpec.tools);

    const userMessage = `You are executing as part of an automated pipeline. Here is your input data:\n\n${JSON.stringify(agentInput, null, 2)}\n\nProcess this input according to your instructions and produce structured JSON output.`;

    const timeoutMs = agentSpec.guardrails.max_runtime_seconds * 1000;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const agentCall = async () => {
      const messages: MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      let iterations = 0;
      const maxIterations = 10;

      while (iterations < maxIterations) {
        iterations++;

        const response = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: agentSpec.guardrails.max_tokens,
          temperature: agentSpec.guardrails.temperature,
          system: agentSpec.system_prompt,
          messages,
          ...(tools.length > 0 ? { tools } : {}),
        });

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
          try {
            let jsonStr = rawOutput.trim();
            const fenceMatch = jsonStr.match(
              /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
            );
            if (fenceMatch) jsonStr = fenceMatch[1].trim();
            if (!jsonStr.startsWith("{")) {
              const s = jsonStr.indexOf("{");
              const e = jsonStr.lastIndexOf("}");
              if (s !== -1 && e > s) jsonStr = jsonStr.slice(s, e + 1);
            }
            output = JSON.parse(jsonStr);
          } catch {
            output = { raw_output: rawOutput };
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

          if (INTERNAL_TOOLS.has(toolId)) {
            // Handle internally — bypass MCP
            resultContent = await handleInternalTool(toolId, toolInput, ctx);
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
                `[Orchestrator] MCP fallback used for "${toolId}": ${mcpResult.error}`
              );
              resultContent = mcpResult.fallback;
            }
          }

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

    // Build token usage record
    const costUsd = calculateCost(ANTHROPIC_MODEL, totalInputTokens, totalOutputTokens);
    const tokenUsage: TokenUsageRecord = {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cost_usd: costUsd,
      model: ANTHROPIC_MODEL,
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

    await updateAgentMessage(messageId, {
      status: "failed",
      error: errorMsg,
      completed_at: new Date().toISOString(),
    });

    return {
      agent_id: agentSpec.agent_id,
      status: "failed",
      output: null,
      error: errorMsg,
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

  const supabase = await createSupabaseServerClient();
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
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
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
  const mcpManager = new MCPClientManager();

  try {
    await mcpManager.startServersForRun(allToolIds);
  } catch (err) {
    console.error("[Orchestrator] MCP startup error (continuing with fallbacks):", err);
  }

  const ctx: RunContext = {
    run_id,
    pipeline,
    input_data,
    agent_outputs: new Map(),
    mcpManager,
  };

  const startTime = Date.now();
  let runTotalTokens = 0;
  let runTotalCost = 0;

  try {
    await updateRunStatus(run_id, "running");

    const agentMap = new Map(pipeline.agents.map((a) => [a.agent_id, a]));
    const layers = topologicalSort(pipeline);

    for (const layer of layers) {
      if (layer.length === 0) continue;

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
            await updateRunStatus(run_id, "failed", new Date().toISOString());
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
              await updateRunStatus(run_id, "failed", new Date().toISOString());
              return;
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    await updateRunAnalytics(run_id, runTotalTokens, runTotalCost, durationMs);
    await updateRunStatus(run_id, "completed", new Date().toISOString());
  } finally {
    // Always shut down MCP servers, even on failure
    await mcpManager.shutdown();
  }
}
