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
 * DELETE /api/pipelines/[id] — Permanently delete a pipeline and all related records.
 * Deletion order respects foreign key constraints.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Confirm the pipeline exists before touching anything
    const { data: existing, error: fetchError } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Pipeline not found." },
        { status: 404 }
      );
    }

    // Step 1 — Collect run IDs for this pipeline
    const { data: runs } = await supabase
      .from("pipeline_runs")
      .select("id")
      .eq("pipeline_id", id);

    const runIds = (runs ?? []).map((r: { id: string }) => r.id);

    // Steps 2–4 — Delete child records scoped to those runs
    if (runIds.length > 0) {
      await supabase.from("token_usage").delete().in("run_id", runIds);
      await supabase.from("approval_requests").delete().in("run_id", runIds);
      await supabase.from("agent_messages").delete().in("run_id", runIds);
    }

    // Step 5 — Delete pipeline_runs
    await supabase.from("pipeline_runs").delete().eq("pipeline_id", id);

    // Step 6 — Delete scheduled triggers
    await supabase
      .from("pipeline_scheduled_triggers")
      .delete()
      .eq("pipeline_id", id);

    // Step 7 — Delete the pipeline itself
    const { error: deleteError } = await supabase
      .from("pipelines")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: `Database error: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Pipeline deleted successfully." },
      { status: 200 }
    );
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
