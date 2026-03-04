import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ErrorAlert {
  run_id: string;
  pipeline_name: string;
  agent_id: string;
  error_message: string;
  severity: "warning" | "error" | "critical";
}

/**
 * Record an error alert as a system notification in agent_messages.
 * This shows up in the run dashboard and can be surfaced in analytics.
 */
export async function sendErrorAlert(alert: ErrorAlert): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    await supabase.from("agent_messages").insert({
      run_id: alert.run_id,
      agent_id: "system_alert",
      status: "completed",
      input: null,
      output: {
        alert_type: "error",
        severity: alert.severity,
        pipeline_name: alert.pipeline_name,
        failed_agent: alert.agent_id,
        error_message: alert.error_message,
        timestamp: new Date().toISOString(),
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    console.error(
      `[ErrorAlert] [${alert.severity.toUpperCase()}] Pipeline "${alert.pipeline_name}" - ` +
        `Agent "${alert.agent_id}": ${alert.error_message}`
    );
  } catch (err) {
    // Alerting itself should never crash the pipeline
    console.error(
      "[ErrorAlert] Failed to send alert:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Determine alert severity based on failure context.
 */
export function classifySeverity(
  onFailure: string,
  isHaltPipeline: boolean
): "warning" | "error" | "critical" {
  if (isHaltPipeline) return "critical";
  if (onFailure === "escalate_to_human") return "error";
  if (onFailure === "retry_3x_then_notify") return "warning";
  return "warning";
}
