import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { approval_id, decision } = body;

    if (!approval_id) {
      return NextResponse.json(
        { error: "approval_id is required." },
        { status: 400 }
      );
    }

    if (!decision || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be 'approved' or 'rejected'." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check the approval exists and is pending
    const { data: existing, error: fetchError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", approval_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Approval request not found." },
        { status: 404 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: `Approval already ${existing.status}.` },
        { status: 409 }
      );
    }

    // Update approval status
    const { data: updated, error: updateError } = await supabase
      .from("approval_requests")
      .update({
        status: decision,
        decided_at: new Date().toISOString(),
      })
      .eq("id", approval_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Database error: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ approval: updated }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
