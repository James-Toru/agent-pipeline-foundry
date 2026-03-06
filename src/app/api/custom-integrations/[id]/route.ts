import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { invalidateCustomToolCache } from "@/lib/custom-tool-executor";

/**
 * DELETE /api/custom-integrations/[id] — Delete a custom integration and all its tools.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("custom_integrations")
      .delete()
      .eq("id", id);

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
 * PATCH /api/custom-integrations/[id] — Update a custom integration.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, base_url, description, auth_type, auth_config, headers, is_active, body_wrapper } =
      body;

    const supabase = await createSupabaseServerClient();

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (base_url !== undefined) update.base_url = base_url;
    if (description !== undefined) update.description = description;
    if (auth_type !== undefined) update.auth_type = auth_type;
    if (auth_config !== undefined) update.auth_config = auth_config;
    if (headers !== undefined) update.headers = headers;
    if (is_active !== undefined) update.is_active = is_active;
    if (body_wrapper !== undefined) update.body_wrapper = body_wrapper || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("custom_integrations")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    invalidateCustomToolCache();
    return NextResponse.json({ integration: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
