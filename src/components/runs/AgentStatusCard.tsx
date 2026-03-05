"use client";

import type { AgentMessage, AgentSpec } from "@/types/pipeline";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ChevronDown,
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
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

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
        {message?.started_at && (
          <span className="ml-auto font-mono">
            {formatDuration(message.started_at, message.completed_at)}
          </span>
        )}
      </div>

      {/* Error */}
      {message?.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg ring-1 ring-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          <XCircle className="size-3 mt-0.5 shrink-0" />
          {message.error}
        </div>
      )}

      {/* Output preview */}
      {message?.output && status === "completed" && (
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
