"use client";

import type { AgentMessage, AgentSpec } from "@/types/pipeline";

const STATUS_STYLES: Record<
  string,
  { dot: string; bg: string; text: string; label: string }
> = {
  pending: {
    dot: "bg-zinc-500",
    bg: "border-zinc-800 bg-zinc-900",
    text: "text-zinc-500",
    label: "Pending",
  },
  running: {
    dot: "bg-blue-400 animate-pulse",
    bg: "border-blue-500/30 bg-blue-500/5",
    text: "text-blue-400",
    label: "Running",
  },
  completed: {
    dot: "bg-emerald-400",
    bg: "border-emerald-500/30 bg-emerald-500/5",
    text: "text-emerald-400",
    label: "Completed",
  },
  failed: {
    dot: "bg-red-400",
    bg: "border-red-500/30 bg-red-500/5",
    text: "text-red-400",
    label: "Failed",
  },
  awaiting_approval: {
    dot: "bg-amber-400 animate-pulse",
    bg: "border-amber-500/30 bg-amber-500/5",
    text: "text-amber-400",
    label: "Awaiting Approval",
  },
};

interface AgentStatusCardProps {
  agentSpec: AgentSpec;
  message: AgentMessage | null;
}

function formatDuration(start: string, end: string | null): string {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.round((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function AgentStatusCard({
  agentSpec,
  message,
}: AgentStatusCardProps) {
  const status = message?.status ?? "pending";
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;

  return (
    <div className={`rounded-lg border p-4 ${style.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          <span className="text-sm font-medium text-white">
            {agentSpec.role}
          </span>
        </div>
        <span className={`text-xs ${style.text}`}>{style.label}</span>
      </div>

      {/* Archetype + tools */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">
          {agentSpec.archetype}
        </span>
        <span>{agentSpec.tools.length} tools</span>
        {message?.started_at && (
          <span className="ml-auto">
            {formatDuration(message.started_at, message.completed_at)}
          </span>
        )}
      </div>

      {/* Error */}
      {message?.error && (
        <div className="mt-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {message.error}
        </div>
      )}

      {/* Output preview */}
      {message?.output && status === "completed" && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
            View output
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-400">
            {JSON.stringify(message.output, null, 2)}
          </pre>
        </details>
      )}

      {/* Input preview */}
      {message?.input && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
            View input
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-400">
            {JSON.stringify(message.input, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
