import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { invalidateCustomToolCache } from "@/lib/custom-tool-executor";

function maskAuthConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!config || typeof config !== "object") return config;
  const type = config.type as string;

  switch (type) {
    case "api_key":
      return { ...config, key_value: maskValue(config.key_value as string) };
    case "bearer_token":
      return { ...config, token: maskValue(config.token as string) };
    case "basic_auth":
      return { ...config, password: maskValue(config.password as string) };
    case "oauth2":
      return {
        ...config,
        client_secret: maskValue(config.client_secret as string),
        access_token: maskValue(config.access_token as string),
        refresh_token: maskValue(config.refresh_token as string),
      };
    case "custom_header":
      return { ...config, header_value: maskValue(config.header_value as string) };
    default:
      return config;
  }
}

function maskValue(value: string | undefined | null): string {
  if (!value) return "";
  return "••••••••" + value.slice(-4);
}

/**
 * GET /api/custom-integrations — List all custom integrations with their tools.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: integrations, error } = await supabase
      .from("custom_integrations")
      .select("*, custom_tools(*)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    // Mask sensitive auth values before sending to the client
    const masked = (integrations ?? []).map(
      (i: Record<string, unknown>) => ({
        ...i,
        auth_config: maskAuthConfig(i.auth_config as Record<string, unknown>),
      })
    );

    return NextResponse.json({ integrations: masked });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/custom-integrations — Create a new custom integration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, base_url, description, auth_type, auth_config, headers, body_wrapper } =
      body;

    if (!name || !base_url) {
      return NextResponse.json(
        { error: "name and base_url are required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("custom_integrations")
      .insert({
        name,
        base_url,
        description: description ?? null,
        auth_type: auth_type ?? "none",
        auth_config: auth_config ?? { type: "none" },
        headers: headers ?? {},
        body_wrapper: body_wrapper || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    invalidateCustomToolCache();
    return NextResponse.json({ integration: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
