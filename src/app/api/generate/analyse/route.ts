import { NextRequest, NextResponse } from "next/server";
import { ANTHROPIC_MODEL, createAnthropicClient } from "@/lib/ai-config";

const ANALYSER_SYSTEM_PROMPT = `You are a pipeline requirements analyst for Agent Foundry,
a system that builds automated multi-agent workflows.

Your job is to read a user's automation request and identify
ONLY the questions that are truly necessary to build a
working pipeline. Do not ask about things you can
reasonably default.

NEVER ask about:
- Message formatting or style
- Number of results (default to 10)
- Whether to include timestamps
- Minor aesthetic preferences
- Anything you can sensibly decide yourself

ALWAYS ask about:
- Missing integration targets (which Slack channel,
  which email address, which HubSpot pipeline)
- Ambiguous trigger frequency ('regularly', 'often',
  'sometimes' — ask for specific interval)
- Scope that would fundamentally change the pipeline
  (all emails vs unread only vs specific sender)
- Missing required identifiers (spreadsheet ID,
  database name, calendar ID)

Respond ONLY with valid JSON. No preamble, no markdown.

If the prompt has enough information to build a good
pipeline, respond with:
{ "ready": true }

If clarification is needed, respond with:
{
  "ready": false,
  "questions": [
    {
      "id": "unique_snake_case_id",
      "question": "Clear, friendly question to the user",
      "reason": "One sentence: why this matters for the pipeline",
      "type": "text",
      "placeholder": "optional hint for text inputs",
      "options": []
    }
  ]
}

type must be one of: "text", "select", "multiselect"
options is only used for select/multiselect types.

Maximum 3 questions. If you need to ask more than 3
things, the prompt is too vague — ask the single most
important question only and let the user resubmit.`;

export async function POST(request: NextRequest) {
  let prompt: string;
  try {
    const body = await request.json();
    prompt = body.prompt;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "prompt is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  try {
    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      temperature: 0.2,
      system: ANALYSER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt.trim() }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ ready: true });
    }

    let rawText = textBlock.text.trim();
    // Strip markdown fences if present
    const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      rawText = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(rawText);
    return NextResponse.json(parsed);
  } catch {
    // On any error, fall through to generation
    return NextResponse.json({ ready: true });
  }
}
