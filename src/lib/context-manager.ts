/**
 * Context Manager — Token optimization for multi-agent pipelines.
 *
 * Reduces token usage by:
 * 1. Summarizing large agent outputs before passing downstream (via Haiku)
 * 2. Compressing large tool results inline
 * 3. Caching tool results so retries don't re-execute
 * 4. Providing a retrieve_context tool for agents that need full data
 */

import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient, SUMMARIZATION_MODEL } from "@/lib/ai-config";
import type { AgentSpec } from "@/types/pipeline";
import { createHash } from "crypto";

const COMPRESSION_THRESHOLD = 2048; // 2KB — outputs below this pass through unchanged

export class ContextManager {
  private summaries = new Map<string, string>();
  private fullOutputs = new Map<string, string>();
  private toolCache = new Map<string, string>();
  private fullToolResults = new Map<string, string>();

  /**
   * Summarize an agent's output for downstream consumption.
   * Full output is stored internally for retrieve_context.
   * Outputs under 2KB are kept as-is.
   */
  async summarizeAgentOutput(
    agentId: string,
    output: Record<string, unknown>,
    agentSpec: AgentSpec
  ): Promise<void> {
    const outputStr = JSON.stringify(output);

    // Always store full output for retrieval
    this.fullOutputs.set(agentId, outputStr);

    // Small outputs pass through unchanged
    if (outputStr.length < COMPRESSION_THRESHOLD) {
      this.summaries.set(agentId, outputStr);
      return;
    }

    try {
      const client = createAnthropicClient();
      const response = await client.messages.create({
        model: SUMMARIZATION_MODEL,
        max_tokens: 1024,
        temperature: 0,
        system:
          "Compress the following agent output into a compact summary. " +
          "Preserve ALL: IDs, URLs, names, email addresses, dates, numerical values, " +
          "status codes, and structured data keys. " +
          "Remove: verbose descriptions, raw HTML, repeated content, boilerplate text. " +
          "Output valid JSON only.",
        messages: [
          {
            role: "user",
            content:
              `Agent role: ${agentSpec.role}\n` +
              `Output fields: ${Object.keys(agentSpec.outputs).join(", ")}\n\n` +
              `Full output:\n${outputStr.slice(0, 8000)}`,
          },
        ],
      });

      const text = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const summary = text?.text ?? outputStr.slice(0, COMPRESSION_THRESHOLD);

      console.log(
        `[ContextManager] Summarized ${agentId}: ${outputStr.length} → ${summary.length} chars`
      );

      this.summaries.set(agentId, summary);
    } catch (err) {
      // Fallback: truncate rather than block the pipeline
      console.warn(
        `[ContextManager] Summarization failed for ${agentId}, using truncation:`,
        err instanceof Error ? err.message : err
      );
      this.summaries.set(agentId, outputStr.slice(0, COMPRESSION_THRESHOLD));
    }
  }

  /**
   * Build compact context for a downstream agent.
   * Uses summaries instead of full outputs. Keeps pipeline inputs unchanged.
   */
  getCompactContext(
    _agentSpec: AgentSpec,
    inputData: Record<string, unknown>,
    agentOutputs: Map<string, Record<string, unknown>>
  ): Record<string, unknown> {
    const context: Record<string, unknown> = { ...inputData };

    for (const [agentId] of agentOutputs) {
      const summary = this.summaries.get(agentId);
      if (summary) {
        // Parse summary back to object if valid JSON, otherwise use as string
        try {
          context[agentId] = JSON.parse(summary);
        } catch {
          context[agentId] = summary;
        }
      }
    }

    return context;
  }

  /**
   * Compress a large tool result. Results under 2KB pass through unchanged.
   * Full result is stored for potential retrieval.
   */
  compressToolResult(toolName: string, result: string): string {
    if (result.length < COMPRESSION_THRESHOLD) {
      return result;
    }

    // Store full result keyed by tool name + timestamp
    const key = `tool:${toolName}:${Date.now()}`;
    this.fullToolResults.set(key, result);

    // For web scraping tools, extract key content
    if (
      toolName === "web_scrape" ||
      toolName === "web_research" ||
      toolName === "web_search"
    ) {
      try {
        const parsed = JSON.parse(result);

        if (toolName === "web_scrape" && parsed.content) {
          // Truncate scraped content aggressively
          return JSON.stringify({
            ...parsed,
            content: parsed.content.slice(0, 1500) + "\n[TRUNCATED — use retrieve_context for full content]",
            _compressed: true,
            _original_length: parsed.content.length,
          });
        }

        if (toolName === "web_research" && parsed.sources) {
          // Keep source metadata, truncate content
          return JSON.stringify({
            ...parsed,
            sources: parsed.sources.map(
              (s: Record<string, unknown>) => ({
                ...s,
                content: typeof s.content === "string"
                  ? (s.content as string).slice(0, 500)
                  : s.content,
              })
            ),
            _compressed: true,
          });
        }
      } catch {
        // Not JSON — truncate raw string
      }
    }

    // Generic compression: truncate long strings
    return result.slice(0, COMPRESSION_THRESHOLD) +
      "\n[TRUNCATED — original was " + result.length + " chars]";
  }

  /**
   * Cache a tool result. Keyed by tool name + hash of input.
   */
  cacheToolResult(
    toolName: string,
    input: Record<string, unknown>,
    result: string
  ): void {
    const key = this.toolCacheKey(toolName, input);
    this.toolCache.set(key, result);
  }

  /**
   * Get a cached tool result. Returns null if not cached.
   */
  getCachedToolResult(
    toolName: string,
    input: Record<string, unknown>
  ): string | null {
    const key = this.toolCacheKey(toolName, input);
    return this.toolCache.get(key) ?? null;
  }

  /**
   * Retrieve full uncompressed output for an agent (used by retrieve_context tool).
   */
  retrieveFullContext(agentId: string, contextKey?: string): string {
    const full = this.fullOutputs.get(agentId);
    if (!full) {
      return JSON.stringify({
        status: "error",
        error: `No stored output for agent: ${agentId}`,
        available_agents: Array.from(this.fullOutputs.keys()),
      });
    }

    if (contextKey) {
      try {
        const parsed = JSON.parse(full);
        if (contextKey in parsed) {
          return JSON.stringify({
            status: "success",
            agent_id: agentId,
            key: contextKey,
            data: parsed[contextKey],
          });
        }
        return JSON.stringify({
          status: "error",
          error: `Key "${contextKey}" not found in agent output`,
          available_keys: Object.keys(parsed),
        });
      } catch {
        return full;
      }
    }

    return JSON.stringify({
      status: "success",
      agent_id: agentId,
      full_output: JSON.parse(full),
    });
  }

  /**
   * Whether any compressed data exists (determines if retrieve_context tool should be injected).
   */
  hasCompressedData(): boolean {
    for (const [agentId, summary] of this.summaries) {
      const full = this.fullOutputs.get(agentId);
      if (full && full.length !== summary.length) {
        return true;
      }
    }
    return false;
  }

  private toolCacheKey(
    toolName: string,
    input: Record<string, unknown>
  ): string {
    const inputHash = createHash("md5")
      .update(JSON.stringify(input))
      .digest("hex");
    return `${toolName}:${inputHash}`;
  }
}
