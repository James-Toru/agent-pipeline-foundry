import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { executeCustomTool } from "@/lib/custom-tool-executor";
import type { CustomTool, CustomIntegration } from "@/types/pipeline";

/**
 * POST /api/custom-integrations/test — Test a custom tool by executing it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool_id, input } = body;

    if (!tool_id) {
      return NextResponse.json(
        { error: "tool_id is required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: tool, error: toolErr } = await supabase
      .from("custom_tools")
      .select("*, custom_integrations(*)")
      .eq("id", tool_id)
      .single();

    if (toolErr || !tool) {
      return NextResponse.json(
        { error: "Tool not found." },
        { status: 404 }
      );
    }

    // Reshape the joined data
    const integration = tool.custom_integrations as unknown as CustomIntegration;
    const customTool: CustomTool & { integration: CustomIntegration } = {
      id: tool.id,
      integration_id: tool.integration_id,
      name: tool.name,
      description: tool.description,
      method: tool.method,
      path: tool.path,
      parameters: tool.parameters,
      response_mapping: tool.response_mapping,
      created_at: tool.created_at,
      updated_at: tool.updated_at,
      integration,
    };

    const result = await executeCustomTool(customTool, input ?? {});

    return NextResponse.json({
      success: result.success,
      result: result.result,
      error: result.error ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
