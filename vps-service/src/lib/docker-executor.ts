/**
 * Docker Executor — runs code in isolated Docker containers.
 *
 * Executes user-generated code inside `agent-foundry-sandbox:latest`,
 * a pre-built Docker image with Python/JS/Bash + common data libraries.
 * Output files written to /workspace/output/ are uploaded to Supabase Storage.
 */

import { spawn } from "child_process";
import {
  writeFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "fs";
import { join } from "path";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const WORKSPACE_BASE = "/tmp/sandbox-runs";
const SANDBOX_IMAGE = "agent-foundry-sandbox:latest";

interface RunnerConfig {
  filename: string;
  cmd: string;
  args: string[];
}

const RUNNERS: Record<string, RunnerConfig> = {
  python: {
    filename: "main.py",
    cmd: "python3",
    args: ["main.py"],
  },
  javascript: {
    filename: "main.js",
    cmd: "node",
    args: ["main.js"],
  },
  bash: {
    filename: "main.sh",
    cmd: "bash",
    args: ["main.sh"],
  },
  sql: {
    filename: "query.sql",
    cmd: "psql",
    args: [process.env.DATABASE_URL ?? "", "-f", "query.sql"],
  },
};

interface ExecuteCodeInput {
  runId: string;
  executionId: string;
  language: string;
  code: string;
  timeoutSeconds?: number;
  needsNetwork?: boolean;
}

interface ExecuteCodeResult {
  success: boolean;
  stdout: string;
  stderr: string;
  files: Array<{ name: string; url: string; size: number }>;
  duration_ms: number;
  exit_code: number;
}

export async function executeCode(
  input: ExecuteCodeInput
): Promise<ExecuteCodeResult> {
  const {
    runId,
    executionId,
    language,
    code,
    timeoutSeconds = 120,
    needsNetwork = false,
  } = input;

  const workdir = join(WORKSPACE_BASE, `${runId}-${executionId}`);
  const outputDir = join(workdir, "output");
  mkdirSync(workdir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const runner = RUNNERS[language];
  if (!runner) {
    return {
      success: false,
      stdout: "",
      stderr: `Unsupported language: ${language}`,
      files: [],
      duration_ms: 0,
      exit_code: 1,
    };
  }

  // Write code to workspace
  writeFileSync(join(workdir, runner.filename), code);

  const startTime = Date.now();

  try {
    // Build docker run command
    const dockerArgs = [
      "run",
      "--rm",
      "--name",
      `sandbox-${runId}-${executionId}`.slice(0, 128),
      "--memory",
      "512m",
      "--cpus",
      "0.5",
      "--pids-limit",
      "50",
      "--tmpfs",
      "/tmp:size=100m",
      "--volume",
      `${workdir}:/workspace`,
      "--workdir",
      "/workspace",
    ];

    // Network control
    if (!needsNetwork) {
      dockerArgs.push("--network", "none");
    }

    dockerArgs.push(SANDBOX_IMAGE, runner.cmd, ...runner.args);

    const result = await runWithTimeout("docker", dockerArgs, timeoutSeconds * 1000);
    const duration_ms = Date.now() - startTime;

    // Collect any generated files from output/
    const generatedFiles: Array<{ name: string; url: string; size: number }> = [];

    try {
      const files = readdirSync(outputDir);
      const supabase = await createSupabaseServerClient();

      for (const file of files) {
        const filePath = join(outputDir, file);
        const fileBuffer = readFileSync(filePath);
        const uploadPath = `runs/${runId}/${executionId}/${file}`;

        const { data: uploadData } = await supabase.storage
          .from("execution-outputs")
          .upload(uploadPath, fileBuffer, {
            upsert: true,
            contentType: getMimeType(file),
          });

        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from("execution-outputs")
            .getPublicUrl(uploadPath);

          generatedFiles.push({
            name: file,
            url: urlData.publicUrl,
            size: fileBuffer.length,
          });
        }
      }
    } catch {
      // No output directory or no files — that is fine
    }

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      files: generatedFiles,
      duration_ms,
      exit_code: result.exitCode,
    };
  } catch (err) {
    return {
      success: false,
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      files: [],
      duration_ms: Date.now() - startTime,
      exit_code: 1,
    };
  } finally {
    // Always clean up workspace
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

function runWithTimeout(
  cmd: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
      // Cap output at 100KB to prevent memory issues
      if (stdout.length > 102400) {
        stdout = stdout.slice(0, 102400) + "\n...(output truncated)";
      }
    });

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 102400) {
        stderr = stderr.slice(0, 102400) + "\n...(stderr truncated)";
      }
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({
        stdout,
        stderr: stderr + "\nExecution timed out",
        exitCode: 124,
      });
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    csv: "text/csv",
    json: "application/json",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    html: "text/html",
    svg: "image/svg+xml",
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}
