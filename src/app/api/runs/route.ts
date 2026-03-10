import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkRateLimit, RUN_LIMIT } from "@/lib/rate-limiter";
import { checkRequiredIntegrations } from "@/lib/pipeline-errors";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit("runs", RUN_LIMIT);
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

    // Pre-flight integration check
    const integrationErrors = checkRequiredIntegrations(pipeline.spec);
    if (integrationErrors.length > 0) {
      const firstError = integrationErrors[0];
      return NextResponse.json(
        {
          error: firstError.user_message,
          action: firstError.action,
          error_code: firstError.code,
          integration: firstError.integration,
          settings_url: "/settings",
        },
        { status: 400 }
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
      console.error(`[Run] Execute fire failed for run ${run.id}:`, err);
    });
    // No await — intentional

    return NextResponse.json({ run }, { status: 202 });
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
