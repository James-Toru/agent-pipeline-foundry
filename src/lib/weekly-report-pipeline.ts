import type { PipelineSpec } from "@/types/pipeline";
import { v4 as uuidv4 } from "uuid";

/**
 * Generates a self-contained pipeline spec for the weekly summary report.
 * This pipeline is executed by the system (not user-generated) and
 * summarizes the prior week's pipeline activity.
 */
export function createWeeklySummarySpec(weekStart: string): PipelineSpec {
  return {
    pipeline_id: uuidv4(),
    name: "Weekly Summary Report",
    description: `Automated weekly summary for the week starting ${weekStart}. Aggregates run metrics, token usage, and failure analysis.`,
    version: 1,
    created_at: new Date().toISOString(),
    triggers: ["schedule"],
    schedule: "0 9 * * 1",
    input_schema: {
      week_start: {
        type: "string",
        required: true,
        description: "ISO date string of the Monday starting the report week",
      },
      report_email: {
        type: "string",
        required: false,
        description: "Email address to send the report to (optional)",
      },
    },
    agents: [
      {
        agent_id: "metrics_collector",
        archetype: "Ingestion",
        role: "Metrics Collector",
        system_prompt:
          "You are a metrics collection agent for the Agent Foundry platform. Query the Supabase database to collect the following data for the specified week: total pipeline runs (by status), total tokens consumed, total cost, average run duration, most active pipelines, and any failed runs with their error messages. Output JSON with fields: total_runs, completed_runs, failed_runs, total_tokens, total_cost_usd, avg_duration_ms, top_pipelines (array), failures (array with run_id, pipeline_name, error).",
        tools: ["supabase_read"],
        inputs: {
          week_start: "Start of the reporting week (ISO date)",
        },
        outputs: {
          total_runs: "Total pipeline runs",
          completed_runs: "Successfully completed runs",
          failed_runs: "Failed runs count",
          total_tokens: "Total tokens consumed",
          total_cost_usd: "Total cost in USD",
          avg_duration_ms: "Average run duration",
          top_pipelines: "Most active pipelines",
          failures: "List of failures with details",
        },
        requires_approval: false,
        approval_message: null,
        on_failure: "retry_3x_then_notify",
        guardrails: {
          max_tokens: 3000,
          max_runtime_seconds: 60,
          temperature: 0.1,
        },
      },
      {
        agent_id: "report_writer",
        archetype: "Report",
        role: "Report Writer",
        system_prompt:
          "You are a report writer for the Agent Foundry platform. Take the weekly metrics and produce a clear, well-structured summary report. Include: executive summary (2-3 sentences), key metrics table, success/failure breakdown, top pipelines by usage, notable failures with root cause hints, and recommendations for improvement. Format as a readable report suitable for stakeholders. Output JSON with fields: report_title, executive_summary, metrics_summary, failure_analysis, recommendations.",
        tools: ["pipeline_notify"],
        inputs: {
          total_runs: "Total runs",
          completed_runs: "Completed runs",
          failed_runs: "Failed runs",
          total_tokens: "Total tokens",
          total_cost_usd: "Total cost",
          avg_duration_ms: "Avg duration",
          top_pipelines: "Top pipelines",
          failures: "Failure details",
        },
        outputs: {
          report_title: "Title of the weekly report",
          executive_summary: "Executive summary paragraph",
          metrics_summary: "Formatted metrics overview",
          failure_analysis: "Analysis of failures",
          recommendations: "Recommendations for next week",
        },
        requires_approval: false,
        approval_message: null,
        on_failure: "retry_3x_then_notify",
        guardrails: {
          max_tokens: 3000,
          max_runtime_seconds: 45,
          temperature: 0.3,
        },
      },
      {
        agent_id: "report_distributor",
        archetype: "Notification",
        role: "Report Distributor",
        system_prompt:
          "You are a report distribution agent. Take the weekly summary report and: 1) Send a dashboard notification with the executive summary, 2) If a report_email is provided, send the full report via email. Output JSON with fields: notified, emailed.",
        tools: ["pipeline_notify", "gmail_send"],
        inputs: {
          report_title: "Report title",
          executive_summary: "Executive summary",
          metrics_summary: "Metrics overview",
          failure_analysis: "Failure analysis",
          recommendations: "Recommendations",
          report_email: "Optional email recipient",
        },
        outputs: {
          notified: "Dashboard notification sent",
          emailed: "Email sent (if applicable)",
        },
        requires_approval: false,
        approval_message: null,
        on_failure: "skip_and_continue",
        guardrails: {
          max_tokens: 2000,
          max_runtime_seconds: 30,
          temperature: 0.1,
        },
      },
    ],
    orchestration: {
      flow: [
        { from: "START", to: "metrics_collector", condition: null },
        { from: "metrics_collector", to: "report_writer", condition: null },
        { from: "report_writer", to: "report_distributor", condition: null },
        { from: "report_distributor", to: "END", condition: null },
      ],
      parallel_groups: [],
    },
    error_handling: {
      global_fallback: "notify_human",
      retry_policy: "exponential",
      max_retries: 2,
      alert_on_failure: true,
    },
    meta: {
      gaps_filled: [
        "Added failure analysis with root cause hints",
        "Added recommendations based on weekly patterns",
      ],
      assumptions: [
        "Report covers Monday 00:00 to Sunday 23:59 UTC",
        "Dashboard notifications are always sent; email is optional",
      ],
      recommended_enhancements: [
        "Add week-over-week comparison metrics",
        "Add Slack integration for report distribution",
      ],
    },
  };
}
