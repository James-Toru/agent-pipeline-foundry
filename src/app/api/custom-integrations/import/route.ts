import { NextRequest, NextResponse } from "next/server";
import { ANTHROPIC_MODEL, createAnthropicClient } from "@/lib/ai-config";

/**
 * POST /api/custom-integrations/import — Parse an OpenAPI spec using Claude
 * and return structured integration + tools data for the frontend to save.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { openapi_spec } = body;

    if (!openapi_spec || typeof openapi_spec !== "string") {
      return NextResponse.json(
        { error: "openapi_spec (string) is required." },
        { status: 400 }
      );
    }

    // Truncate very large specs to avoid blowing context
    const truncated = openapi_spec.substring(0, 50000);

    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: `You are an OpenAPI spec parser. Given an OpenAPI/Swagger specification, extract the API details into a structured JSON format.

Return a JSON object with this exact shape:
{
  "name": "Human-readable API name",
  "base_url": "https://api.example.com",
  "description": "Brief description",
  "auth_type": "none" | "api_key" | "bearer_token" | "basic_auth" | "oauth2",
  "auth_config": { ... },
  "tools": [
    {
      "name": "snake_case_tool_name",
      "description": "What this endpoint does",
      "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      "path": "/path/{id}",
      "parameters": {
        "path": [{"name": "id", "type": "string", "description": "...", "required": true}],
        "query": [],
        "body": []
      }
    }
  ]
}

Rules:
- Tool names must be snake_case
- Extract at most 20 most useful endpoints
- Identify the auth scheme from the spec's securityDefinitions/components/security
- For auth_config, set type matching auth_type. Leave credential values empty.
- Return ONLY the JSON object, no markdown fences.`,
      messages: [{ role: "user", content: truncated }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Failed to parse OpenAPI spec." },
        { status: 500 }
      );
    }

    const rawText = textBlock.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(rawText);
      return NextResponse.json({ parsed });
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON. Try a simpler spec." },
        { status: 422 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
