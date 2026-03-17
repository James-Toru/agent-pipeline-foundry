import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL_ID } from "@/lib/models";

export const ANTHROPIC_MODEL: string =
  process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL_ID;

// Fast, cheap model for mechanical tasks like context summarization
export const SUMMARIZATION_MODEL = "claude-haiku-4-5-20251001";

export const AnthropicConfig = {
  model: ANTHROPIC_MODEL,
  metaAgent: {
    max_tokens: 8000,
    temperature: 0.3,
  },
  runtimeAgent: {
    max_tokens: 4000,
    temperature: 0.3,
  },
} as const;

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in Settings → Integrations or set it as an environment variable."
    );
  }
  return new Anthropic({ apiKey });
}
