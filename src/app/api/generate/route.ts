import { NextRequest, NextResponse } from "next/server";
import { generatePipeline } from "@/lib/meta-agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json(
        { error: "Input is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    const result = await generatePipeline(input.trim());

    if (result.success) {
      return NextResponse.json({ spec: result.spec }, { status: 200 });
    }

    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: 500 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
