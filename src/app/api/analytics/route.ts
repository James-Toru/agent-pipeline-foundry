import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/analytics — Dashboard statistics with optional period filter.
 *
 * Query params:
 *   period: "7d" | "30d" | "90d" | "all" (default "30d")
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const period = request.nextUrl.searchParams.get("period") ?? "30d";

    // Calculate date boundary
    let since: string | null = null;
    const now = new Date();
    if (period === "7d") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === "30d") {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === "90d") {
      since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Total runs in period
    let runsQuery = supabase
      .from("pipeline_runs")
      .select("id, status, total_tokens, total_cost_usd, duration_ms, started_at", { count: "exact" });
    if (since) runsQuery = runsQuery.gte("started_at", since);
    const { data: runs, count: totalRuns } = await runsQuery;

    const runsList = runs ?? [];

    // Aggregate stats
    const completedRuns = runsList.filter((r) => r.status === "completed").length;
    const failedRuns = runsList.filter((r) => r.status === "failed").length;
    const totalTokens = runsList.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0);
    const totalCost = runsList.reduce((sum, r) => sum + parseFloat(r.total_cost_usd ?? "0"), 0);
    const avgDuration = runsList.length > 0
      ? runsList.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / runsList.length
      : 0;

    const successRate = (totalRuns ?? 0) > 0
      ? Math.round((completedRuns / (totalRuns ?? 1)) * 100)
      : 0;

    // Daily token usage for chart data
    let tokenQuery = supabase
      .from("token_usage")
      .select("input_tokens, output_tokens, cost_usd, created_at")
      .order("created_at", { ascending: true });
    if (since) tokenQuery = tokenQuery.gte("created_at", since);
    const { data: tokenRecords } = await tokenQuery;

    // Group by date
    const dailyUsage: Record<string, { tokens: number; cost: number; runs: number }> = {};
    for (const record of tokenRecords ?? []) {
      const date = record.created_at.split("T")[0];
      if (!dailyUsage[date]) dailyUsage[date] = { tokens: 0, cost: 0, runs: 0 };
      dailyUsage[date].tokens += record.input_tokens + record.output_tokens;
      dailyUsage[date].cost += parseFloat(record.cost_usd ?? "0");
    }

    // Count runs per day
    for (const run of runsList) {
      const date = run.started_at.split("T")[0];
      if (!dailyUsage[date]) dailyUsage[date] = { tokens: 0, cost: 0, runs: 0 };
      dailyUsage[date].runs += 1;
    }

    const chartData = Object.entries(dailyUsage)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // Total pipelines
    const { count: totalPipelines } = await supabase
      .from("pipelines")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      period,
      stats: {
        total_runs: totalRuns ?? 0,
        completed_runs: completedRuns,
        failed_runs: failedRuns,
        success_rate: successRate,
        total_tokens: totalTokens,
        total_cost_usd: Math.round(totalCost * 1000000) / 1000000,
        avg_duration_ms: Math.round(avgDuration),
        total_pipelines: totalPipelines ?? 0,
      },
      chart_data: chartData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
