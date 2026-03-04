import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL: string =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5-20250929";

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
      "ANTHROPIC_API_KEY is not set. Add a valid Anthropic API key to your .env.local file."
    );
  }
  return new Anthropic({ apiKey });
}
