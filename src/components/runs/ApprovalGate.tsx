"use client";

import { useState } from "react";
import type { ApprovalRequest } from "@/types/pipeline";

interface ApprovalGateProps {
  approval: ApprovalRequest;
  onDecision: (approvalId: string, decision: "approved" | "rejected") => void;
}

export default function ApprovalGate({
  approval,
  onDecision,
}: ApprovalGateProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDecision(decision: "approved" | "rejected") {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approval.id,
          decision,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Approval failed:", data.error);
        return;
      }

      onDecision(approval.id, decision);
    } catch (err) {
      console.error("Approval request failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (approval.status !== "pending") {
    const isApproved = approval.status === "approved";
    return (
      <div
        className={`rounded-lg border p-4 ${
          isApproved
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isApproved ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
          <span className="text-sm font-medium text-white">
            Approval: {approval.agent_id}
          </span>
          <span
            className={`ml-auto text-xs ${
              isApproved ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isApproved ? "Approved" : "Rejected"}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">{approval.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        <span className="text-sm font-medium text-white">
          Approval Required: {approval.agent_id}
        </span>
      </div>

      {/* Message */}
      <p className="mt-2 text-sm text-amber-200">{approval.message}</p>

      {/* Context */}
      {approval.context && Object.keys(approval.context).length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
            Review context data
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
            {JSON.stringify(approval.context, null, 2)}
          </pre>
        </details>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => handleDecision("approved")}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          {isSubmitting ? "..." : "Approve"}
        </button>
        <button
          onClick={() => handleDecision("rejected")}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
        >
          {isSubmitting ? "..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
