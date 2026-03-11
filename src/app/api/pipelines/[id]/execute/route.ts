import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runPipeline } from "@/lib/orchestrator";

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify the request came from our VPS relay
  const secret = request.headers.get("x-execute-secret");
  if (secret !== process.env.VPS_EXECUTE_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id: pipelineId } = await params;
  const { runId, inputs, triggerType, webhookPayload } = await request.json();

  if (!runId) {
    return NextResponse.json(
      { error: "runId is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("*")
      .eq("id", pipelineId)
      .single();

    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    // Merge webhook payload into inputs if present
    const resolvedInputs = webhookPayload && triggerType === "webhook"
      ? { ...webhookPayload, ...(inputs ?? {}) }
      : inputs ?? {};

    await runPipeline(runId, pipeline.spec, resolvedInputs);

    return NextResponse.json({ success: true, runId });
  } catch (err) {
    console.error("[Execute] Pipeline failed:", err);

    // Safety net: mark run as failed if orchestrator didn't already
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("pipeline_runs")
        .select("status")
        .eq("id", runId)
        .single();

      if (data?.status !== "failed" && data?.status !== "cancelled") {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("pipeline_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_code: "UNKNOWN_ERROR",
            error_message: errorMsg,
            error_user_message:
              "An unexpected error occurred during this pipeline run.",
            error_action:
              "Check the error details below. If the problem persists contact support with the run ID.",
          })
          .eq("id", runId);
      }
    } catch (cleanupErr) {
      console.error("[Execute] Failed to update run status:", cleanupErr);
    }

    return NextResponse.json(
      { error: "Pipeline execution failed" },
      { status: 500 }
    );
  }
}
