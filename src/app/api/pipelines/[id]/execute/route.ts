import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runPipeline } from "@/lib/orchestrator";

export const maxDuration = 800;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Internal-only route — protected by shared secret
  if (!process.env.INTERNAL_SECRET) {
    console.error("[Execute] INTERNAL_SECRET not set");
    return new Response("Server misconfigured", { status: 500 });
  }

  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: pipelineId } = await params;

  let runId: string;
  try {
    const body = await req.json();
    runId = body.runId;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!runId) {
    return new Response("runId is required", { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Fetch the pipeline spec
  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("*")
    .eq("id", pipelineId)
    .single();

  if (pipelineError || !pipeline) {
    console.error(`[Execute] Pipeline ${pipelineId} not found`);
    return new Response("Pipeline not found", { status: 404 });
  }

  // Fetch the run record for input_data
  const { data: run, error: runError } = await supabase
    .from("pipeline_runs")
    .select("input_data")
    .eq("id", runId)
    .single();

  if (runError || !run) {
    console.error(`[Execute] Run ${runId} not found`);
    return new Response("Run not found", { status: 404 });
  }

  try {
    await runPipeline(runId, pipeline.spec, run.input_data ?? {});
    return new Response(JSON.stringify({ status: "completed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Execute] Pipeline run ${runId} failed:`, message);

    // Orchestrator should have written structured errors already.
    // Safety net: mark as failed if not already.
    const { data: currentRun } = await supabase
      .from("pipeline_runs")
      .select("status")
      .eq("id", runId)
      .single();

    if (currentRun?.status !== "failed") {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_code: "UNKNOWN_ERROR",
          error_message: message,
          error_user_message:
            "An unexpected error occurred during this pipeline run.",
          error_action:
            "Check the error details below. If the problem persists contact support with the run ID.",
        })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({ status: "failed", error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
