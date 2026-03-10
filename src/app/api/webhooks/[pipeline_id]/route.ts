import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

    const supabase = await createSupabaseServerClient();

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
    let input_data: Record<string, unknown> = {};
    try {
      input_data = await request.json();
    } catch {
      // Empty body is acceptable — pipeline may not require inputs
    }

    // Create the run record
    const { data: run, error: runError } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_id,
        status: "pending",
        input_data,
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

    // Fire the execute route without awaiting — pipeline runs in background
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`;

    fetch(`${baseUrl}/api/pipelines/${pipeline_id}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_SECRET!,
      },
      body: JSON.stringify({ runId: run.id }),
    }).catch((err) => {
      console.error(`[Webhook] Execute fire failed for run ${run.id}:`, err);
    });
    // No await — intentional

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
