"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import AgentStatusCard from "@/components/runs/AgentStatusCard";
import ApprovalGate from "@/components/runs/ApprovalGate";
import type {
  PipelineSpec,
  PipelineRunStatus,
  AgentMessage,
  AgentSpec,
  ApprovalRequest,
} from "@/types/pipeline";

const RUN_STATUS_STYLES: Record<
  PipelineRunStatus,
  { dot: string; text: string; label: string }
> = {
  pending: { dot: "bg-zinc-500", text: "text-zinc-400", label: "Pending" },
  running: {
    dot: "bg-blue-400 animate-pulse",
    text: "text-blue-400",
    label: "Running",
  },
  paused: {
    dot: "bg-amber-400 animate-pulse",
    text: "text-amber-400",
    label: "Paused — Awaiting Approval",
  },
  completed: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    label: "Completed",
  },
  failed: { dot: "bg-red-400", text: "text-red-400", label: "Failed" },
};

interface RunData {
  id: string;
  pipeline_id: string;
  status: PipelineRunStatus;
  input_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  pipelines: { name: string; spec: PipelineSpec } | null;
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

  // Initial fetch
  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Supabase Realtime subscriptions
  useEffect(() => {
    const supabase = supabaseRef.current;

    // Subscribe to agent_messages changes for this run
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

    // Subscribe to pipeline_runs changes
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
          const updated = payload.new as RunData;
          setRun((prev) =>
            prev ? { ...prev, status: updated.status, completed_at: updated.completed_at } : prev
          );
        }
      )
      .subscribe();

    // Subscribe to approval_requests changes
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-lg">Run not found.</p>
        <Link
          href="/pipelines"
          className="mt-3 text-sm text-zinc-400 hover:text-white"
        >
          Back to pipelines &rarr;
        </Link>
      </div>
    );
  }

  const spec = run.pipelines?.spec;
  const pipelineName = run.pipelines?.name ?? "Pipeline";
  const statusStyle = RUN_STATUS_STYLES[run.status] ?? RUN_STATUS_STYLES.pending;

  // Build a map of agent_id → latest message
  const messageMap = new Map<string, AgentMessage>();
  for (const msg of messages) {
    const existing = messageMap.get(msg.agent_id);
    if (!existing || new Date(msg.started_at) > new Date(existing.started_at)) {
      messageMap.set(msg.agent_id, msg);
    }
  }

  // Pending approvals
  const pendingApprovals = approvals.filter((a) => a.status === "pending");

  // Calculate progress
  const totalAgents = spec?.agents.length ?? 0;
  const completedAgents = [...messageMap.values()].filter(
    (m) => m.status === "completed"
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/pipelines/${run.pipeline_id}`}
                className="text-sm text-zinc-500 hover:text-white"
              >
                &larr; {pipelineName}
              </Link>
              <h1 className="mt-1 text-lg font-semibold text-white">
                Run Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${statusStyle.dot}`} />
              <span className={`text-sm font-medium ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          {totalAgents > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {completedAgents} / {totalAgents} agents
                </span>
                <span>
                  {totalAgents > 0
                    ? Math.round((completedAgents / totalAgents) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${
                      totalAgents > 0
                        ? (completedAgents / totalAgents) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Run meta */}
          <div className="mt-3 flex gap-4 text-xs text-zinc-500">
            <span>
              Started:{" "}
              {new Date(run.started_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            {run.completed_at && (
              <span>
                Ended:{" "}
                {new Date(run.completed_at).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
            <span className="font-mono text-zinc-600">
              {runId.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Pending approvals (prominent) */}
          {pendingApprovals.length > 0 && (
            <div className="space-y-3">
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
              <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-300">
                Pipeline input data
              </summary>
              <pre className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">
                {JSON.stringify(run.input_data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
