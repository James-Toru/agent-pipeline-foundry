"use client";

import type { AgentMessage, AgentSpec } from "@/types/pipeline";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ChevronDown,
  Cpu,
  Terminal,
  Download,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; ring: string; bg: string; text: string; label: string }
> = {
  pending: {
    icon: <Clock className="size-4 text-zinc-500" />,
    ring: "ring-white/6",
    bg: "bg-zinc-900/80",
    text: "text-zinc-500",
    label: "Pending",
  },
  running: {
    icon: <Loader2 className="size-4 text-blue-400 animate-spin" />,
    ring: "ring-blue-500/20",
    bg: "bg-blue-500/5",
    text: "text-blue-400",
    label: "Running",
  },
  completed: {
    icon: <CheckCircle2 className="size-4 text-emerald-400" />,
    ring: "ring-emerald-500/20",
    bg: "bg-emerald-500/5",
    text: "text-emerald-400",
    label: "Completed",
  },
  failed: {
    icon: <XCircle className="size-4 text-red-400" />,
    ring: "ring-red-500/20",
    bg: "bg-red-500/5",
    text: "text-red-400",
    label: "Failed",
  },
  awaiting_approval: {
    icon: <ShieldAlert className="size-4 text-amber-400 animate-pulse" />,
    ring: "ring-amber-500/20",
    bg: "bg-amber-500/5",
    text: "text-amber-400",
    label: "Awaiting Approval",
  },
};

interface AgentStatusCardProps {
  agentSpec: AgentSpec;
  message: AgentMessage | null;
}

interface CodeExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  files?: Array<{ name: string; url: string; size: number }>;
  duration_ms?: number;
  exit_code?: number;
  attempt?: number;
  code?: string;
  language?: string;
}

function formatDuration(start: string, end: string | null): string {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.round((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Extract code execution results from agent output if present */
function extractCodeExecution(
  output: Record<string, unknown> | null
): CodeExecutionResult | null {
  if (!output) return null;

  // Check if output itself is a code execution result
  if ("exit_code" in output && ("stdout" in output || "stderr" in output)) {
    return output as unknown as CodeExecutionResult;
  }

  // Check nested fields for code execution results
  for (const value of Object.values(output)) {
    if (
      value &&
      typeof value === "object" &&
      "exit_code" in (value as Record<string, unknown>) &&
      ("stdout" in (value as Record<string, unknown>) ||
        "stderr" in (value as Record<string, unknown>))
    ) {
      return value as unknown as CodeExecutionResult;
    }
  }

  // Check if the _raw field contains a JSON code execution result
  if (typeof output._raw === "string") {
    try {
      const parsed = JSON.parse(output._raw);
      if (parsed.exit_code !== undefined) {
        return parsed as CodeExecutionResult;
      }
    } catch {
      // not JSON
    }
  }

  return null;
}

function CodeExecutionCard({ execution }: { execution: CodeExecutionResult }) {
  return (
    <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-emerald-400" />
          <span className="text-sm font-medium text-white">Code Execution</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              execution.success
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {execution.success ? "Success" : "Failed"}
          </span>
          {execution.duration_ms != null && (
            <span className="text-xs text-zinc-600">
              {execution.duration_ms}ms
              {execution.attempt != null && execution.attempt > 1 &&
                ` \u00b7 attempt ${execution.attempt}`}
            </span>
          )}
        </div>
        {execution.language && (
          <span className="text-xs text-zinc-600 font-mono">{execution.language}</span>
        )}
      </div>

      {/* Output */}
      {execution.stdout && execution.stdout !== "(no output)" && (
        <div className="p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Output</p>
          <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap bg-black/30 rounded-lg p-3 max-h-64 overflow-y-auto">
            {execution.stdout}
          </pre>
        </div>
      )}

      {/* Error */}
      {!execution.success && execution.stderr && (
        <div className="px-4 pb-4">
          <p className="text-xs text-red-400 uppercase tracking-wide mb-2">Error</p>
          <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap bg-red-950/20 rounded-lg p-3 max-h-40 overflow-y-auto">
            {execution.stderr}
          </pre>
        </div>
      )}

      {/* Generated files */}
      {execution.files && execution.files.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
            Generated Files
          </p>
          <div className="space-y-1.5">
            {execution.files.map((file) => (
              <a
                key={file.url}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Download className="size-3" />
                <span>{file.name}</span>
                <span className="text-xs text-zinc-600">
                  {formatBytes(file.size)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Code — collapsed by default */}
      {execution.code && (
        <details className="border-t border-zinc-800">
          <summary className="px-4 py-2.5 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors list-none flex items-center gap-1 select-none">
            <ChevronDown className="size-3 chevron-icon" />
            View generated code
          </summary>
          <pre className="text-xs text-zinc-400 font-mono p-4 bg-black/20 overflow-x-auto max-h-96 overflow-y-auto">
            {execution.code}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function AgentStatusCard({
  agentSpec,
  message,
}: AgentStatusCardProps) {
  const status = message?.status ?? "pending";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  const codeExecution = message?.output
    ? extractCodeExecution(message.output as Record<string, unknown>)
    : null;

  return (
    <div className={`rounded-xl ring-1 ${config.ring} ${config.bg} p-4 transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {config.icon}
          <span className="text-sm font-medium text-white">
            {agentSpec.role}
          </span>
        </div>
        <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
      </div>

      {/* Archetype + tools */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500">
        <Badge variant="info">{agentSpec.archetype}</Badge>
        <span>{agentSpec.tools.length} tools</span>
        {agentSpec.model && (
          <span className="flex items-center gap-1 text-violet-400">
            <Cpu className="size-2.5" />
            {agentSpec.model.replace("claude-", "").replace(/-\d+$/, "")}
          </span>
        )}
        {message?.started_at && (
          <span className="ml-auto font-mono">
            {formatDuration(message.started_at, message.completed_at)}
          </span>
        )}
      </div>

      {/* Error */}
      {message?.status === "failed" && (
        <div className="mt-3 space-y-2">
          <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-3">
            <p className="text-red-300 text-sm font-medium">
              {message.error_user_message ?? message.error ?? "This agent failed to complete"}
            </p>

            {message.error_action && (
              <p className="text-red-200/70 text-xs mt-2">
                {message.error_action}
              </p>
            )}

            {message.error_details &&
              typeof message.error_details === "object" &&
              (message.error_details as Record<string, unknown>).settings_url ? (
                <Link
                  href={(message.error_details as Record<string, unknown>).settings_url as string}
                  className="inline-block mt-2 text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
                >
                  Go to Settings to fix this &rarr;
                </Link>
              ) : null}
          </div>

          <details className="group">
            <summary className="text-xs text-red-400/60 cursor-pointer hover:text-red-400/80 list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block text-[10px]">{"\u25B6"}</span>
              Technical details
            </summary>
            <div className="mt-2 bg-black/30 rounded-lg p-2">
              <p className="text-xs text-red-300/50 font-mono break-all whitespace-pre-wrap">
                {message.error_code ? <span>Code: {message.error_code}{"\n"}</span> : null}
                {message.error}
              </p>
            </div>
          </details>
        </div>
      )}

      {/* Code Execution Result */}
      {codeExecution && <CodeExecutionCard execution={codeExecution} />}

      {/* Output preview (skip if code execution card already shown) */}
      {message?.output && status === "completed" && !codeExecution && (
        <details className="mt-3 group">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronDown className="size-3 chevron-icon" />
            View output
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg ring-1 ring-white/6 bg-zinc-950 p-2 text-xs text-zinc-400">
            {JSON.stringify(message.output, null, 2)}
          </pre>
        </details>
      )}

      {/* Raw output for code execution agents (non-code fields) */}
      {message?.output && status === "completed" && codeExecution && (
        <details className="mt-2 group">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronDown className="size-3 chevron-icon" />
            View full output
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg ring-1 ring-white/6 bg-zinc-950 p-2 text-xs text-zinc-400">
            {JSON.stringify(message.output, null, 2)}
          </pre>
        </details>
      )}

      {/* Input preview */}
      {message?.input && (
        <details className="mt-2 group">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronDown className="size-3 chevron-icon" />
            View input
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg ring-1 ring-white/6 bg-zinc-950 p-2 text-xs text-zinc-400">
            {JSON.stringify(message.input, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
