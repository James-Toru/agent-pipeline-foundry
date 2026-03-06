import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { invalidateCustomToolCache } from "@/lib/custom-tool-executor";

/**
 * PATCH /api/custom-integrations/[id]/tools/[toolId] — Update a tool.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const { id, toolId } = await params;
    const body = await request.json();

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("custom_tools")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", toolId)
      .eq("integration_id", id);

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    invalidateCustomToolCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/custom-integrations/[id]/tools/[toolId] — Remove a tool.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const { id, toolId } = await params;
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("custom_tools")
      .delete()
      .eq("id", toolId)
      .eq("integration_id", id);

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    invalidateCustomToolCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
