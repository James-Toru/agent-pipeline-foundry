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
