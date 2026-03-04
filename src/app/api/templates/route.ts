import { NextResponse } from "next/server";
import { PIPELINE_TEMPLATES } from "@/lib/templates";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { v4 as uuidv4 } from "uuid";

/**
 * GET /api/templates — Returns all available pipeline templates.
 */
export async function GET() {
  try {
    const templates = PIPELINE_TEMPLATES.map((t, i) => ({
      id: `template-${i}`,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      agent_count: t.spec.agents.length,
      triggers: t.spec.triggers,
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/templates — Clone a template into a new pipeline.
 * Body: { template_index: number }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { template_index } = body;

    if (template_index == null || template_index < 0 || template_index >= PIPELINE_TEMPLATES.length) {
      return NextResponse.json(
        { error: `Invalid template_index. Must be 0-${PIPELINE_TEMPLATES.length - 1}.` },
        { status: 400 }
      );
    }

    const template = PIPELINE_TEMPLATES[template_index];

    // Create a fresh spec with new IDs
    const newSpec = {
      ...template.spec,
      pipeline_id: uuidv4(),
      created_at: new Date().toISOString(),
    };

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pipelines")
      .insert({
        name: template.name,
        description: template.description,
        spec: newSpec,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pipeline: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
