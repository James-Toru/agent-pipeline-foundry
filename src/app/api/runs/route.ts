import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runPipeline } from "@/lib/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipeline_id, input_data } = body;

    if (!pipeline_id) {
      return NextResponse.json(
        { error: "pipeline_id is required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Fetch the pipeline spec
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .select("*")
      .eq("id", pipeline_id)
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found." },
        { status: 404 }
      );
    }

    // Create the run record
    const { data: run, error: runError } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_id,
        status: "pending",
        input_data: input_data ?? {},
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: `Failed to create run: ${runError?.message}` },
        { status: 500 }
      );
    }

    // Start the pipeline execution asynchronously (fire-and-forget)
    // The orchestrator writes status updates to Supabase for Realtime
    runPipeline(run.id, pipeline.spec, input_data ?? {}).catch((err) => {
      console.error(`Pipeline run ${run.id} failed:`, err);
      // Update run status to failed
      createSupabaseServerClient().then((sb) =>
        sb
          .from("pipeline_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id)
      );
    });

    return NextResponse.json({ run }, { status: 201 });
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
      .from("pipeline_runs")
      .select("*, pipelines(name)")
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ runs: data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
