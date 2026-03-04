import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, createAnthropicClient } from "@/lib/ai-config";
import { getToolsForAgent } from "@/lib/tool-registry";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  PipelineSpec,
  AgentSpec,
  OnFailurePolicy,
  PipelineRunStatus,
  AgentMessageStatus,
} from "@/types/pipeline";

type MessageParam = Anthropic.MessageParam;

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentResult {
  agent_id: string;
  status: "completed" | "failed";
  output: Record<string, unknown> | null;
  error: string | null;
}

interface RunContext {
  run_id: string;
  pipeline: PipelineSpec;
  input_data: Record<string, unknown>;
  agent_outputs: Map<string, Record<string, unknown>>;
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
    // Group parallel agents in the same layer
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
            (g) => g.length === groupIds.length && g.every((x) => groupIds.includes(x))
          )
        ) {
          parallelInLayer.push(groupIds);
        }
      } else {
        sequential.push(id);
      }
    }

    // Add sequential agents as individual layers, parallel groups as one layer
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
    // Look through all upstream outputs for this key
    for (const [, outputs] of ctx.agent_outputs) {
      if (key in outputs) {
        agentInput[key] = outputs[key];
      }
    }
    // Also pull from pipeline input_data
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

    // Build the user message with input context
    const userMessage = `You are executing as part of an automated pipeline. Here is your input data:\n\n${JSON.stringify(agentInput, null, 2)}\n\nProcess this input according to your instructions and produce structured JSON output.`;

    // Enforce timeout
    const timeoutMs = agentSpec.guardrails.max_runtime_seconds * 1000;

    const agentCall = async () => {
      // Tool-use loop: keep calling until we get a final text response or hit limits
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

        // Check if we got a tool use block
        const toolUseBlocks = response.content.filter(
          (b) => b.type === "tool_use"
        );

        if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
          // Extract final text response
          const textBlock = response.content.find((b) => b.type === "text");
          const rawOutput =
            textBlock && textBlock.type === "text" ? textBlock.text : "";

          // Try to parse as JSON output
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

        // Simulate tool calls — in production these would call real MCP servers
        // For now, return simulated results and continue the loop
        const assistantContent: Anthropic.ContentBlock[] = response.content;

        messages.push({ role: "assistant", content: assistantContent });

        // Build tool results
        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map((b) => ({
            type: "tool_result" as const,
            tool_use_id: b.id,
            content: JSON.stringify({
              status: "success",
              data: { message: `Simulated result for ${b.name}`, input: b.input },
            }),
          }));

        messages.push({ role: "user", content: toolResults });
      }

      // If we exhausted iterations, return what we have
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

  // Update agent message to awaiting_approval
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("agent_messages")
    .update({ status: "awaiting_approval" })
    .eq("run_id", ctx.run_id)
    .eq("agent_id", agentSpec.agent_id)
    .order("started_at", { ascending: false })
    .limit(1);

  // Pause the run
  await updateRunStatus(ctx.run_id, "paused");

  // Wait for approval (timeout = agent's max_runtime_seconds, min 300s for human response)
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
      // After 3 retries, notify and skip
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
    // Exponential backoff for retries
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const result = await executeAgent(agentSpec, ctx);

    if (result.status === "completed") {
      // Handle approval gate
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

      // Store output for downstream agents
      if (result.output) {
        ctx.agent_outputs.set(agentSpec.agent_id, result.output);
      }

      return result;
    }

    // Agent failed — apply failure policy
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
  const ctx: RunContext = {
    run_id,
    pipeline,
    input_data,
    agent_outputs: new Map(),
  };

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
      // Sequential execution
      const result = await executeAgentWithRetry(agents[0], ctx);

      if (
        result.status === "failed" &&
        agents[0].on_failure === "halt_pipeline"
      ) {
        await updateRunStatus(run_id, "failed", new Date().toISOString());
        return;
      }
    } else {
      // Parallel execution with Promise.all
      const results = await Promise.all(
        agents.map((a) => executeAgentWithRetry(a, ctx))
      );

      // Check if any critical agent failed with halt policy
      for (let i = 0; i < results.length; i++) {
        if (
          results[i].status === "failed" &&
          agents[i].on_failure === "halt_pipeline"
        ) {
          await updateRunStatus(run_id, "failed", new Date().toISOString());
          return;
        }
      }
    }
  }

  await updateRunStatus(run_id, "completed", new Date().toISOString());
}
