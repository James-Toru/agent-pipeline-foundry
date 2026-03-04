import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/analytics/runs — Paginated run history with filters.
 *
 * Query params:
 *   page:        number (default 1)
 *   per_page:    number (default 20, max 100)
 *   status:      "completed" | "failed" | "running" | "pending" | "paused"
 *   pipeline_id: uuid filter
 *   sort:        "started_at" | "duration_ms" | "total_tokens" | "total_cost_usd" (default "started_at")
 *   order:       "asc" | "desc" (default "desc")
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const params = request.nextUrl.searchParams;

    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(params.get("per_page") ?? "20", 10)));
    const status = params.get("status");
    const pipelineId = params.get("pipeline_id");
    const sort = params.get("sort") ?? "started_at";
    const order = params.get("order") ?? "desc";

    const validSortFields = ["started_at", "duration_ms", "total_tokens", "total_cost_usd"];
    const sortField = validSortFields.includes(sort) ? sort : "started_at";

    let query = supabase
      .from("pipeline_runs")
      .select(
        "id, pipeline_id, status, total_tokens, total_cost_usd, duration_ms, started_at, completed_at, pipelines(name)",
        { count: "exact" }
      );

    if (status) query = query.eq("status", status);
    if (pipelineId) query = query.eq("pipeline_id", pipelineId);

    query = query
      .order(sortField, { ascending: order === "asc" })
      .range((page - 1) * perPage, page * perPage - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalPages = Math.ceil((count ?? 0) / perPage);

    return NextResponse.json({
      runs: data ?? [],
      pagination: {
        page,
        per_page: perPage,
        total: count ?? 0,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
