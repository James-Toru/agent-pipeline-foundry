import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { validatePipelineSpec } from "@/lib/pipeline-validator";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Pipeline not found." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ pipeline: data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { spec } = body;

    if (!spec) {
      return NextResponse.json(
        { error: "spec is required." },
        { status: 400 }
      );
    }

    const validation = validatePipelineSpec(spec);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid pipeline spec.", details: validation.errors },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check existence first
    const { data: existing } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Pipeline not found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("pipelines")
      .update({
        name: validation.spec.name,
        description: validation.spec.description,
        spec: validation.spec,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ pipeline: data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/pipelines/[id] — Duplicate a pipeline.
 * Creates a copy with a new ID and "(Copy)" appended to the name.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: source, error: fetchError } = await supabase
      .from("pipelines")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json(
        { error: "Pipeline not found." },
        { status: 404 }
      );
    }

    const newSpec = {
      ...source.spec,
      pipeline_id: uuidv4(),
      name: `${source.spec.name} (Copy)`,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("pipelines")
      .insert({
        name: `${source.name} (Copy)`,
        description: source.description,
        spec: newSpec,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ pipeline: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
