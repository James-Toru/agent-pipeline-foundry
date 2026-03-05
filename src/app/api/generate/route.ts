import { NextRequest } from "next/server";
import { generatePipelineStream } from "@/lib/meta-agent";
import { checkRateLimit, GENERATE_LIMIT } from "@/lib/rate-limiter";

export async function POST(request: NextRequest) {
  // Rate limit check — return plain JSON before opening the stream
  const rl = checkRateLimit("generate", GENERATE_LIMIT);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rl.resetInSeconds.toString(),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let input: string;
  try {
    const body = await request.json();
    input = body.input;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!input || typeof input !== "string" || input.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Input is required and must be a non-empty string." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const result = await generatePipelineStream(input.trim(), (step, percent) => {
          send({ type: "progress", step, percent });
        });

        if (result.success) {
          send({ type: "complete", spec: result.spec });
        } else {
          send({ type: "error", error: result.error });
        }
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Generation failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
