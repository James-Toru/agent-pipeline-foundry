import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { runPipeline } from "@/lib/orchestrator";
import { checkRateLimit, WEBHOOK_LIMIT } from "@/lib/rate-limiter";

export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pipeline_id: string }> }
) {
  try {
    const { pipeline_id } = await params;

    const rl = checkRateLimit(`webhook:${pipeline_id}`, WEBHOOK_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
        {
          status: 429,
          headers: {
            "Retry-After": rl.resetInSeconds.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const supabase = await createSupabaseServiceClient();

    // Fetch the pipeline
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

    // Validate that this pipeline accepts webhook triggers
    const triggers: string[] = pipeline.spec?.triggers ?? [];
    if (!triggers.includes("webhook")) {
      return NextResponse.json(
        {
          error:
            "This pipeline does not accept webhook triggers. Add 'webhook' to the pipeline's triggers array.",
        },
        { status: 400 }
      );
    }

    // Parse input data from request body
    let webhookBody: Record<string, unknown> = {};
    try {
      webhookBody = await request.json();
    } catch {
      // Empty body is acceptable — pipeline may not require inputs
    }

    // Create the run record
    const { data: run, error: runError } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_id,
        status: "pending",
        input_data: webhookBody,
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

    const vpsRelayUrl = process.env.VPS_RELAY_URL;
    const isDev = process.env.NODE_ENV === "development";

    if (vpsRelayUrl && !isDev) {
      // Fire job to VPS relay — do not await the fetch
      fetch(`${vpsRelayUrl}/relay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shared-secret": process.env.VPS_SHARED_SECRET!,
        },
        body: JSON.stringify({
          pipelineId: pipeline_id,
          runId: run.id,
          inputs: {},
          triggerType: "webhook",
          webhookPayload: webhookBody,
        }),
      }).catch((err) => {
        console.error("[Webhook] Failed to reach VPS relay:", err);
      });

      return NextResponse.json(
        { received: true, run_id: run.id },
        { status: 200 }
      );
    }

    // Fallback: no VPS configured — run locally (fire-and-forget)
    runPipeline(run.id, pipeline.spec, webhookBody).catch((err) => {
      console.error(`[Webhook] Pipeline run ${run.id} failed:`, err);
      createSupabaseServiceClient().then((sb) =>
        sb
          .from("pipeline_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id)
      );
    });

    return NextResponse.json(
      {
        received: true,
        run_id: run.id,
        pipeline_name: pipeline.name,
        message: "Pipeline run started",
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
