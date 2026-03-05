"use client";

import { useState } from "react";
import type { ApprovalRequest } from "@/types/pipeline";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Check,
  X,
  ChevronDown,
  Loader2,
} from "lucide-react";

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
        className={`rounded-xl ring-1 p-4 ${
          isApproved
            ? "ring-emerald-500/20 bg-emerald-500/5"
            : "ring-red-500/20 bg-red-500/5"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isApproved ? (
            <ShieldCheck className="size-4 text-emerald-400" />
          ) : (
            <ShieldX className="size-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-white">
            Approval: {approval.agent_id}
          </span>
          <span
            className={`ml-auto text-xs font-medium ${
              isApproved ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isApproved ? "Approved" : "Rejected"}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">{approval.message}</p>
        {approval.decided_at && (
          <p className="mt-1 text-xs text-zinc-600">
            {new Date(approval.decided_at).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl ring-1 ring-amber-500/20 bg-amber-500/5 p-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <ShieldAlert className="size-5 text-amber-400 animate-pulse" />
        <span className="text-sm font-medium text-white">
          Approval Required: {approval.agent_id}
        </span>
      </div>

      {/* Message */}
      <p className="mt-2 text-sm text-amber-200">{approval.message}</p>

      {/* Context */}
      {approval.context && Object.keys(approval.context).length > 0 && (
        <details className="mt-3">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronDown className="size-3 chevron-icon" />
            Review context data
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded-lg ring-1 ring-white/6 bg-zinc-950 p-3 text-xs text-zinc-400">
            {JSON.stringify(approval.context, null, 2)}
          </pre>
        </details>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => handleDecision("approved")}
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-40"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Approve
        </button>
        <button
          onClick={() => handleDecision("rejected")}
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl ring-1 ring-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-all duration-200 hover:bg-red-500/10 disabled:opacity-40"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          Reject
        </button>
      </div>
    </div>
  );
}
