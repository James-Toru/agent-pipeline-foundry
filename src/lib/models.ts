// ── Model Registry ──────────────────────────────────────────────────────────
// Single source of truth for all available Anthropic models.
// No model string should appear anywhere else in the codebase.

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  context_window: number;
  max_output: number;
  pricing: { input: number; output: number }; // per million tokens (USD)
  tier: "fast" | "balanced" | "powerful";
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude 4.5 Haiku",
    description: "Fastest and most cost-effective. Best for simple, high-volume agent tasks.",
    context_window: 200000,
    max_output: 8192,
    pricing: { input: 0.8, output: 4 },
    tier: "fast",
  },
  {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude 4.5 Sonnet",
    description: "Balanced speed and intelligence. Recommended for most pipeline agents.",
    context_window: 200000,
    max_output: 8192,
    pricing: { input: 3, output: 15 },
    tier: "balanced",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude 4.6 Sonnet",
    description: "Latest Sonnet model with improved reasoning and tool use.",
    context_window: 200000,
    max_output: 16384,
    pricing: { input: 3, output: 15 },
    tier: "balanced",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude 4.6 Opus",
    description: "Most capable model. Best for complex reasoning and pipeline design.",
    context_window: 200000,
    max_output: 32768,
    pricing: { input: 15, output: 75 },
    tier: "powerful",
  },
];

/** The default model used when no override is configured. */
export const DEFAULT_MODEL_ID = "claude-sonnet-4-5-20250929";

/** The model used for the Meta-Agent (pipeline generation). */
export const META_AGENT_MODEL_ID = "claude-sonnet-4-5-20250929";

/** Look up a model definition by ID. Returns undefined if not found. */
export function getModelById(id: string): ModelDefinition | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id);
}

/** Get the display name for a model ID. Falls back to the raw ID. */
export function getModelName(id: string): string {
  return getModelById(id)?.name ?? id;
}

/**
 * Resolve the effective model for an agent, applying the priority chain:
 *   1. Agent-level override (agent.model)
 *   2. Pipeline-level override (pipeline.model)
 *   3. Global default (from settings or DEFAULT_MODEL_ID)
 */
export function resolveModel(
  agentModel?: string | null,
  pipelineModel?: string | null,
  globalDefault?: string | null
): string {
  return agentModel || pipelineModel || globalDefault || DEFAULT_MODEL_ID;
}

/**
 * Get the pricing for a model. Returns default Sonnet pricing if unknown.
 */
export function getModelPricing(
  modelId: string
): { input: number; output: number } {
  return getModelById(modelId)?.pricing ?? { input: 3, output: 15 };
}
