import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runPipeline } from "@/lib/orchestrator";
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

    // Clean up stale runs stuck in "pending" for over 10 minutes
    supabase
      .from("pipeline_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_code: "STALE_RUN",
        error_message: "Run was stuck in pending state for over 10 minutes",
        error_user_message:
          "This run timed out before execution started. This usually means the VPS relay was unreachable.",
        error_action: "Check VPS connectivity in Settings and try again.",
      })
      .eq("pipeline_id", pipeline_id)
      .eq("status", "pending")
      .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .neq("id", run.id)
      .then(() => {});

    const vpsRelayUrl = process.env.VPS_RELAY_URL;
    const isDev = process.env.NODE_ENV === "development";

    if (vpsRelayUrl && !isDev) {
      // Fire job to VPS executor — do not await the fetch
      fetch(`${vpsRelayUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shared-secret": process.env.VPS_SHARED_SECRET!,
        },
        body: JSON.stringify({
          run_id: run.id,
          spec: pipeline.spec,
          input_data: input_data ?? {},
        }),
      }).catch((err) => {
        console.error("[Run] Failed to reach VPS executor:", err);
      });

      // Return immediately — VPS runs the orchestrator directly
      return NextResponse.json(
        { run, status: "started" },
        { status: 202 }
      );
    }

    // Fallback: no VPS configured — run locally (fire-and-forget)
    runPipeline(run.id, pipeline.spec, input_data ?? {}).catch((err) => {
      console.error(`Pipeline run ${run.id} failed:`, err);
      createSupabaseServerClient().then((sb) =>
        sb
          .from("pipeline_runs")
          .select("status")
          .eq("id", run.id)
          .single()
          .then(({ data }) => {
            if (data?.status !== "failed") {
              const errorMsg =
                err instanceof Error ? err.message : String(err);
              sb.from("pipeline_runs")
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
                .eq("id", run.id)
                .then(() => {});
            }
          })
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
