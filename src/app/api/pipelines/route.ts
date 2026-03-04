import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { validatePipelineSpec } from "@/lib/pipeline-validator";

export async function POST(request: NextRequest) {
  try {
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

    const { data, error } = await supabase
      .from("pipelines")
      .insert({
        id: validation.spec.pipeline_id,
        name: validation.spec.name,
        description: validation.spec.description,
        spec: validation.spec,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ pipelines: data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
