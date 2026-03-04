import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Fetch run with pipeline name
    const { data: run, error: runError } = await supabase
      .from("pipeline_runs")
      .select("*, pipelines(name, spec)")
      .eq("id", id)
      .single();

    if (runError) {
      if (runError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Run not found." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Database error: ${runError.message}` },
        { status: 500 }
      );
    }

    // Fetch agent messages for this run
    const { data: messages, error: messagesError } = await supabase
      .from("agent_messages")
      .select("*")
      .eq("run_id", id)
      .order("started_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { error: `Database error: ${messagesError.message}` },
        { status: 500 }
      );
    }

    // Fetch approval requests for this run
    const { data: approvals, error: approvalsError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("run_id", id)
      .order("created_at", { ascending: true });

    if (approvalsError) {
      return NextResponse.json(
        { error: `Database error: ${approvalsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { run, messages: messages ?? [], approvals: approvals ?? [] },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
