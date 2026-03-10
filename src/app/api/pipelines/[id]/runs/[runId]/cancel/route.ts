import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;

  const supabase = await createSupabaseServerClient();

  // Only cancel runs that are still active
  const { data: run, error: fetchError } = await supabase
    .from("pipeline_runs")
    .select("status")
    .eq("id", runId)
    .single();

  if (fetchError || !run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  if (run.status !== "running" && run.status !== "pending" && run.status !== "paused") {
    return NextResponse.json(
      { error: `Cannot cancel a run with status "${run.status}".` },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("pipeline_runs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to cancel run: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "cancelled", runId }, { status: 200 });
}
