import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { processDueTriggers, calculateNextRun } from "@/lib/scheduler";
import { checkRateLimit, SCHEDULER_LIMIT } from "@/lib/rate-limiter";

/**
 * GET — Scheduler heartbeat.
 * Processes all due triggers. In production, call this via a cron job
 * or Supabase Edge Function every minute.
 */
export async function GET() {
  try {
    const rl = checkRateLimit("scheduler", SCHEDULER_LIMIT);
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
    const processed = await processDueTriggers(supabase);

    return NextResponse.json(
      {
        processed,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — Create or update a scheduled trigger.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipeline_id, cron_expression, input_data } = body;

    if (!pipeline_id) {
      return NextResponse.json(
        { error: "pipeline_id is required." },
        { status: 400 }
      );
    }

    if (!cron_expression) {
      return NextResponse.json(
        { error: "cron_expression is required." },
        { status: 400 }
      );
    }

    // Validate cron expression
    let nextRunAt: Date;
    try {
      nextRunAt = calculateNextRun(cron_expression);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Invalid cron expression.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify pipeline exists
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", pipeline_id)
      .single();

    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found." },
        { status: 404 }
      );
    }

    const { data: trigger, error } = await supabase
      .from("pipeline_scheduled_triggers")
      .upsert(
        {
          pipeline_id,
          cron_expression,
          input_data: input_data ?? {},
          is_active: true,
          next_run_at: nextRunAt.toISOString(),
        },
        { onConflict: "pipeline_id" }
      )
      .select()
      .single();

    if (error) {
      // If upsert on conflict fails (no unique constraint on pipeline_id), do insert
      const { data: inserted, error: insertError } = await supabase
        .from("pipeline_scheduled_triggers")
        .insert({
          pipeline_id,
          cron_expression,
          input_data: input_data ?? {},
          is_active: true,
          next_run_at: nextRunAt.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: `Database error: ${insertError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ trigger: inserted }, { status: 201 });
    }

    return NextResponse.json({ trigger }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
