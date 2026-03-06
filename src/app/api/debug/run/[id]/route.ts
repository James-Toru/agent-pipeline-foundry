import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  const supabase = await createSupabaseServerClient();

  const [{ data: run }, { data: messages }] = await Promise.all([
    supabase
      .from("pipeline_runs")
      .select("id, status, error_code, error_message, error_user_message, error_action, error_integration, started_at, completed_at")
      .eq("id", runId)
      .single(),
    supabase
      .from("agent_messages")
      .select("*")
      .eq("run_id", runId)
      .order("started_at"),
  ]);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({
    run_id: runId,
    status: run.status,
    error_code: run.error_code,
    error_message: run.error_message,
    error_user_message: run.error_user_message,
    started_at: run.started_at,
    completed_at: run.completed_at,
    agents: messages?.map((m) => ({
      agent_id: m.agent_id,
      status: m.status,
      started_at: m.started_at,
      completed_at: m.completed_at,
      input_preview: JSON.stringify(m.input)?.substring(0, 300),
      output_preview: JSON.stringify(m.output)?.substring(0, 300),
      error: m.error,
      error_code: m.error_code,
      error_user_message: m.error_user_message,
    })),
  });
}
