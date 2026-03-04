import { CronExpressionParser } from "cron-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runPipeline } from "@/lib/orchestrator";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledTrigger {
  id: string;
  pipeline_id: string;
  cron_expression: string;
  input_data: Record<string, unknown>;
  next_run_at: string;
}

// ── Cron Helpers ─────────────────────────────────────────────────────────────

/**
 * Calculate the next run date from a cron expression.
 * Throws a descriptive error if the expression is invalid.
 */
export function calculateNextRun(cronExpression: string): Date {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
    });
    return interval.next().toDate();
  } catch (err) {
    throw new Error(
      `Invalid cron expression "${cronExpression}": ${
        err instanceof Error ? err.message : "parse error"
      }`
    );
  }
}

// ── Trigger Queries ──────────────────────────────────────────────────────────

/**
 * Returns all active triggers that are due to run (next_run_at <= now).
 */
export async function getScheduledTriggersDue(
  supabase: SupabaseClient
): Promise<ScheduledTrigger[]> {
  const { data, error } = await supabase
    .from("pipeline_scheduled_triggers")
    .select("id, pipeline_id, cron_expression, input_data, next_run_at")
    .eq("is_active", true)
    .lte("next_run_at", new Date().toISOString());

  if (error) {
    console.error("[Scheduler] Error querying due triggers:", error.message);
    return [];
  }

  return (data ?? []) as ScheduledTrigger[];
}

// ── Process Due Triggers ─────────────────────────────────────────────────────

/**
 * Finds all due triggers, starts pipeline runs, and updates next_run_at.
 * Returns the number of triggers processed.
 */
export async function processDueTriggers(
  supabase: SupabaseClient
): Promise<number> {
  const triggers = await getScheduledTriggersDue(supabase);

  if (triggers.length === 0) {
    console.log("[Scheduler] No due triggers found");
    return 0;
  }

  for (const trigger of triggers) {
    try {
      // Fetch the pipeline spec
      const { data: pipeline, error: pipelineError } = await supabase
        .from("pipelines")
        .select("spec")
        .eq("id", trigger.pipeline_id)
        .single();

      if (pipelineError || !pipeline) {
        console.error(
          `[Scheduler] Pipeline ${trigger.pipeline_id} not found, skipping trigger ${trigger.id}`
        );
        continue;
      }

      // Create a new run record
      const { data: run, error: runError } = await supabase
        .from("pipeline_runs")
        .insert({
          pipeline_id: trigger.pipeline_id,
          status: "pending",
          input_data: trigger.input_data,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (runError || !run) {
        console.error(
          `[Scheduler] Failed to create run for trigger ${trigger.id}:`,
          runError?.message
        );
        continue;
      }

      // Fire and forget — orchestrator manages its own status updates
      runPipeline(run.id, pipeline.spec, trigger.input_data).catch((err) => {
        console.error(
          `[Scheduler] Pipeline run ${run.id} failed:`,
          err instanceof Error ? err.message : err
        );
      });

      // Update trigger: set last_run_at and calculate next_run_at
      const nextRunAt = calculateNextRun(trigger.cron_expression);
      await supabase
        .from("pipeline_scheduled_triggers")
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt.toISOString(),
        })
        .eq("id", trigger.id);

      console.log(
        `[Scheduler] Triggered pipeline ${trigger.pipeline_id}, run ${run.id}. Next run: ${nextRunAt.toISOString()}`
      );
    } catch (err) {
      console.error(
        `[Scheduler] Error processing trigger ${trigger.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(`[Scheduler] Processed ${triggers.length} trigger(s)`);
  return triggers.length;
}
