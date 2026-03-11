import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { createWeeklySummarySpec } from "@/lib/weekly-report-pipeline";
import { runPipeline } from "@/lib/orchestrator";

/**
 * POST /api/system/weekly-report — Trigger a weekly summary report.
 * Body: { week_start?: string, report_email?: string }
 *
 * If week_start is "auto" or not provided, it defaults to the previous Monday.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let weekStart = body.week_start as string | undefined;
    const reportEmail = body.report_email as string | undefined;

    // Auto-calculate previous Monday
    if (!weekStart || weekStart === "auto") {
      const now = new Date();
      const day = now.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - diff - 7);
      monday.setUTCHours(0, 0, 0, 0);
      weekStart = monday.toISOString().split("T")[0];
    }

    const spec = createWeeklySummarySpec(weekStart);

    // Save the pipeline spec
    const supabase = await createSupabaseServiceClient();
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .insert({
        name: spec.name,
        description: spec.description,
        spec,
      })
      .select("id")
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json(
        { error: `Failed to save pipeline: ${pipelineError?.message}` },
        { status: 500 }
      );
    }

    // Create a run
    const inputData: Record<string, unknown> = { week_start: weekStart };
    if (reportEmail) inputData.report_email = reportEmail;

    const { data: run, error: runError } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_id: pipeline.id,
        status: "pending",
        input_data: inputData,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: `Failed to create run: ${runError?.message}` },
        { status: 500 }
      );
    }

    // Fire and forget
    runPipeline(run.id, spec, inputData).catch((err) => {
      console.error(
        `[WeeklyReport] Run ${run.id} failed:`,
        err instanceof Error ? err.message : err
      );
    });

    return NextResponse.json(
      {
        message: "Weekly report triggered.",
        pipeline_id: pipeline.id,
        run_id: run.id,
        week_start: weekStart,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
