import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { invalidateCustomToolCache } from "@/lib/custom-tool-executor";

/**
 * POST /api/custom-integrations/[id]/tools — Add a tool to a custom integration.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, method, path, parameters, response_mapping } =
      body;

    if (!name || !description || !path) {
      return NextResponse.json(
        { error: "name, description, and path are required." },
        { status: 400 }
      );
    }

    // Validate tool name format (snake_case, no spaces)
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      return NextResponse.json(
        {
          error:
            "Tool name must be snake_case (lowercase letters, numbers, underscores, starting with a letter).",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify integration exists
    const { data: integration } = await supabase
      .from("custom_integrations")
      .select("id")
      .eq("id", id)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("custom_tools")
      .insert({
        integration_id: id,
        name,
        description,
        method: method ?? "GET",
        path,
        parameters: parameters ?? { path: [], query: [], body: [] },
        response_mapping: response_mapping ?? {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    invalidateCustomToolCache();
    return NextResponse.json({ tool: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
