"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import AgentStatusCard from "@/components/runs/AgentStatusCard";
import ApprovalGate from "@/components/runs/ApprovalGate";
import { Badge } from "@/components/ui/badge";
import type {
  PipelineSpec,
  PipelineRunStatus,
  AgentMessage,
  AgentSpec,
  ApprovalRequest,
} from "@/types/pipeline";
import {
  ChevronLeft,
  Bot,
  Clock,
  CheckCircle2,
  ChevronDown,
  Loader2,
} from "lucide-react";

type BadgeVariant = "default" | "info" | "success" | "warning" | "error";

const RUN_STATUS_CONFIG: Record<
  PipelineRunStatus,
  { badge: BadgeVariant; label: string; ping?: boolean }
> = {
  pending: { badge: "default", label: "Pending" },
  running: { badge: "info", label: "Running", ping: true },
  paused: { badge: "warning", label: "Paused — Awaiting Approval", ping: true },
  completed: { badge: "success", label: "Completed" },
  failed: { badge: "error", label: "Failed" },
};

interface RunData {
  id: string;
  pipeline_id: string;
  status: PipelineRunStatus;
  input_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  pipelines: { name: string; spec: PipelineSpec } | null;
  // Structured error fields
  error_code: string | null;
  error_message: string | null;
  error_user_message: string | null;
  error_action: string | null;
  error_integration: string | null;
  error_details: Record<string, unknown> | null;
}

export default function RunDashboardPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;

  const [run, setRun] = useState<RunData | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const supabaseRef = useRef(createSupabaseBrowserClient());

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load run");
      const data = await res.json();
      setRun(data.run);
      setMessages(data.messages);
      setApprovals(data.approvals);
    } catch (err) {
      console.error("Failed to fetch run:", err);
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Supabase Realtime subscriptions
  useEffect(() => {
    const supabase = supabaseRef.current;

    const messagesChannel = supabase
      .channel(`run-messages-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_messages",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const newMessage = payload.new as AgentMessage;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === newMessage.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = newMessage;
              return updated;
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    const runChannel = supabase
      .channel(`run-status-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pipeline_runs",
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<RunData>;
          setRun((prev) =>
            prev ? { ...prev, ...updated } : prev
          );
        }
      )
      .subscribe();

    const approvalsChannel = supabase
      .channel(`run-approvals-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_requests",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const newApproval = payload.new as ApprovalRequest;
          setApprovals((prev) => {
            const idx = prev.findIndex((a) => a.id === newApproval.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = newApproval;
              return updated;
            }
            return [...prev, newApproval];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(runChannel);
      supabase.removeChannel(approvalsChannel);
    };
  }, [runId]);

  // All useMemo hooks must be declared before any early returns (Rules of Hooks)
  const messageMap = useMemo(() => {
    const map = new Map<string, AgentMessage>();
    for (const msg of messages) {
      const existing = map.get(msg.agent_id);
      if (!existing || new Date(msg.started_at) > new Date(existing.started_at)) {
        map.set(msg.agent_id, msg);
      }
    }
    return map;
  }, [messages]);

  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === "pending"),
    [approvals]
  );

  const { completedAgents, progressPercent, totalAgents } = useMemo(() => {
    const total = run?.pipelines?.spec?.agents.length ?? 0;
    const completed = [...messageMap.values()].filter(
      (m) => m.status === "completed"
    ).length;
    return {
      totalAgents: total,
      completedAgents: completed,
      progressPercent: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [messageMap, run?.pipelines?.spec?.agents.length]);

  function handleApprovalDecision(approvalId: string, decision: "approved" | "rejected") {
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === approvalId
          ? { ...a, status: decision, decided_at: new Date().toISOString() }
          : a
      )
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="size-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-lg">Run not found.</p>
        <Link
          href="/pipelines"
          className="mt-3 flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to pipelines
        </Link>
      </div>
    );
  }

  const spec = run.pipelines?.spec;
  const pipelineName = run.pipelines?.name ?? "Pipeline";
  const statusConfig = RUN_STATUS_CONFIG[run.status] ?? RUN_STATUS_CONFIG.pending;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-white/6 bg-zinc-950/80 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/pipelines/${run.pipeline_id}`}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
              >
                <ChevronLeft className="size-4" />
                {pipelineName}
              </Link>
              <div className="mt-1 flex items-center gap-2.5">
                <h1 className="text-lg font-semibold text-white">Run Dashboard</h1>
                <Badge variant={statusConfig.badge} dot>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
            <code className="text-xs text-zinc-600 font-mono bg-zinc-900 ring-1 ring-white/6 px-2 py-1 rounded-md">
              {runId.slice(0, 8)}
            </code>
          </div>

          {/* Progress bar */}
          {totalAgents > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Bot className="size-3" />
                  {completedAgents} / {totalAgents} agents completed
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800/80 ring-1 ring-white/4 overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 shadow-sm shadow-emerald-500/30 transition-all duration-700"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Run meta */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3" />
              Started{" "}
              {new Date(run.started_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            {run.completed_at && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3" />
                Ended{" "}
                {new Date(run.completed_at).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Pipeline-level error banner */}
          {run.status === "failed" && run.error_user_message && (
            <div className="border border-red-500/50 bg-red-950/30 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <span className="text-red-400 text-xl mt-0.5 shrink-0">{"\u26A0"}</span>
                <div className="flex-1">
                  <h3 className="text-red-400 font-semibold text-base mb-1">Pipeline Failed</h3>
                  <p className="text-red-200 text-sm">{run.error_user_message}</p>
                </div>
              </div>

              {run.error_action && (
                <div className="mt-3 pt-3 border-t border-red-500/30">
                  <p className="text-sm font-medium text-red-300 mb-1">How to fix this:</p>
                  <p className="text-sm text-red-200/80">{run.error_action}</p>
                  {run.error_integration && (
                    <Link
                      href="/settings"
                      className="inline-flex items-center gap-1 mt-2 text-sm text-red-400 hover:text-red-300 underline underline-offset-2"
                    >
                      Go to Settings &rarr;
                    </Link>
                  )}
                </div>
              )}

              {run.error_code && (
                <div className="mt-3 pt-3 border-t border-red-500/20">
                  <p className="text-xs text-red-400/60">
                    Error code: {run.error_code} | Run ID: {run.id}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pending approvals */}
          {pendingApprovals.length > 0 && (
            <div className="space-y-3 animate-fade-up">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                Action Required
              </h2>
              {pendingApprovals.map((approval) => (
                <ApprovalGate
                  key={approval.id}
                  approval={approval}
                  onDecision={handleApprovalDecision}
                />
              ))}
            </div>
          )}

          {/* Agent timeline */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Agent Execution
            </h2>
            {spec?.agents.map((agent: AgentSpec) => (
              <AgentStatusCard
                key={agent.agent_id}
                agentSpec={agent}
                message={messageMap.get(agent.agent_id) ?? null}
              />
            ))}
            {!spec && (
              <p className="text-sm text-zinc-500">
                Pipeline spec not available.
              </p>
            )}
          </div>

          {/* Resolved approvals */}
          {approvals.filter((a) => a.status !== "pending").length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Approval History
              </h2>
              {approvals
                .filter((a) => a.status !== "pending")
                .map((approval) => (
                  <ApprovalGate
                    key={approval.id}
                    approval={approval}
                    onDecision={handleApprovalDecision}
                  />
                ))}
            </div>
          )}

          {/* Input data */}
          {run.input_data && Object.keys(run.input_data).length > 0 && (
            <details>
              <summary className="flex items-center gap-1.5 cursor-pointer text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                <ChevronDown className="size-3.5 chevron-icon" />
                Pipeline input data
              </summary>
              <pre className="mt-2 rounded-xl ring-1 ring-white/6 bg-zinc-900 p-4 text-xs text-zinc-400">
                {JSON.stringify(run.input_data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
