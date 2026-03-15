import type { AnthropicTool } from "@/lib/tool-registry";

// ── Tool Definition ──────────────────────────────────────────────────────────

export const EXECUTE_CODE_TOOL_DEFINITION: AnthropicTool = {
  name: "execute_code",
  description:
    "Write and execute code in a secure Docker sandbox. " +
    "Use this for data processing, analysis, file generation, " +
    "web scraping, or any computation. The code runs in an isolated " +
    "container with pandas, numpy, requests, beautifulsoup4, matplotlib, " +
    "openpyxl, and more pre-installed. " +
    "To save output files, write them to /workspace/output/ and they " +
    "will be uploaded and returned as download URLs. " +
    "Print results to stdout for them to be captured in the output.",
  input_schema: {
    type: "object",
    properties: {
      language: {
        type: "string",
        enum: ["python", "javascript", "bash", "sql"],
        description: "Programming language to use",
      },
      code: {
        type: "string",
        description:
          "Complete, runnable code to execute. Must be self-contained. " +
          "Write output files to /workspace/output/",
      },
      timeout_seconds: {
        type: "number",
        description:
          "Max execution time in seconds. Default 120. " +
          "Use more for heavy data processing.",
      },
      needs_network: {
        type: "boolean",
        description:
          "Set true only for web scraping or HTTP requests. Default false.",
      },
      description: {
        type: "string",
        description: "One sentence describing what this code does",
      },
    },
    required: ["language", "code"],
  },
};

// ── Tool Executor ────────────────────────────────────────────────────────────

export async function executeCodeTool(
  input: {
    language: string;
    code: string;
    timeout_seconds?: number;
    needs_network?: boolean;
    description?: string;
  },
  runId: string,
  attempt: number = 1
): Promise<string> {
  const vpsRelayUrl = process.env.VPS_RELAY_URL;

  if (!vpsRelayUrl) {
    return JSON.stringify({
      success: false,
      error:
        "Code execution service not configured. " +
        "Set VPS_RELAY_URL in environment variables.",
    });
  }

  const executionId = `${Date.now()}-attempt${attempt}`;
  const timeoutSeconds = input.timeout_seconds ?? 120;

  try {
    const response = await fetch(`${vpsRelayUrl}/execute-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shared-secret": process.env.VPS_SHARED_SECRET!,
      },
      body: JSON.stringify({
        runId,
        executionId,
        language: input.language,
        code: input.code,
        timeoutSeconds,
        needsNetwork: input.needs_network ?? false,
      }),
      signal: AbortSignal.timeout((timeoutSeconds + 30) * 1000),
    });

    const result = await response.json();

    return JSON.stringify({
      success: result.success,
      stdout: result.stdout || "(no output)",
      stderr: result.stderr || null,
      files: result.files || [],
      duration_ms: result.duration_ms,
      exit_code: result.exit_code,
      attempt,
    });
  } catch (err) {
    return JSON.stringify({
      success: false,
      error:
        err instanceof Error ? err.message : "Code execution failed",
      attempt,
    });
  }
}
