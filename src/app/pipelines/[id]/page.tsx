"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ReactFlowProvider } from "@xyflow/react";
import type { PipelineRecord, AgentSpec, PipelineSpec } from "@/types/pipeline";
import PipelineGraph from "@/components/pipeline/PipelineGraph";
import AgentCard from "@/components/pipeline/AgentCard";
import MetaBlock from "@/components/generate/MetaBlock";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Copy,
  Play,
  AlertCircle,
  Zap,
  Bot,
  Calendar,
  Webhook,
  Loader2,
  Save,
  Trash2,
  Cpu,
} from "lucide-react";
import DeletePipelineDialog from "@/components/pipeline/DeletePipelineDialog";


export default function PipelineInspectorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pipelineId = params.id;

  const [pipeline, setPipeline] = useState<PipelineRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentSpec | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load pipeline");
      const data = await res.json();
      setPipeline(data.pipeline);
    } catch {
      setSaveError("Failed to load pipeline.");
    } finally {
      setIsLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  function updateSpec(newSpec: PipelineSpec) {
    if (!pipeline) return;
    setPipeline({ ...pipeline, spec: newSpec });
    setHasUnsavedChanges(true);
  }

  function handleAgentUpdate(updatedAgent: AgentSpec) {
    if (!pipeline) return;
    const newAgents = pipeline.spec.agents.map((a) =>
      a.agent_id === updatedAgent.agent_id ? updatedAgent : a
    );
    updateSpec({ ...pipeline.spec, agents: newAgents });
    setSelectedAgent(updatedAgent);
  }

  function handleNameChange(name: string) {
    if (!pipeline) return;
    updateSpec({ ...pipeline.spec, name });
  }

  async function handleSave() {
    if (!pipeline) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: pipeline.spec }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const data = await res.json();
      setPipeline(data.pipeline);
      setHasUnsavedChanges(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDuplicate() {
    setIsDuplicating(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to duplicate");
      }
      const data = await res.json();
      router.push(`/pipelines/${data.pipeline.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Duplicate failed.");
      setIsDuplicating(false);
    }
  }

  function handleDiscard() {
    setSelectedAgent(null);
    setHasUnsavedChanges(false);
    setIsLoading(true);
    fetchPipeline();
  }

  async function handleDeleteConfirm() {
    if (!pipeline) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete pipeline");
      }
      router.push("/pipelines");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete pipeline"
      );
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="size-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-lg">Pipeline not found.</p>
        <Link href="/pipelines" className="mt-3 flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft className="size-4" />
          Back to pipelines
        </Link>
      </div>
    );
  }

  if (!pipeline) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="flex flex-col gap-3 border-b border-white/6 bg-zinc-950/80 backdrop-blur-sm px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/pipelines"
            className="flex shrink-0 items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Pipelines</span>
          </Link>
          <span className="text-zinc-800 hidden sm:inline">/</span>
          <input
            type="text"
            value={pipeline.spec.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none border-b border-transparent focus:border-zinc-600 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 ring-1 ring-white/8 px-3 py-1.5 text-sm text-zinc-300 transition-all duration-200 disabled:opacity-40"
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">{isDuplicating ? "Duplicating..." : "Duplicate"}</span>
          </button>
          <Link
            href={`/runs/new?pipeline=${pipelineId}`}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-emerald-500/20 transition-all duration-200"
          >
            <Play className="size-3.5" />
            <span className="hidden sm:inline">Run Pipeline</span>
          </Link>
          <div className="ml-1 h-5 w-px bg-white/10 shrink-0" />
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg ring-1 ring-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 hover:ring-red-500/50 transition-all duration-200"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/8 px-6 py-2.5 text-sm text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            Failed to delete: {deleteError}
          </div>
          <button
            onClick={() => setDeleteError(null)}
            className="ml-4 shrink-0 text-red-400/60 hover:text-red-300 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph */}
        <div className="flex-1 p-4">
          <ReactFlowProvider>
            <PipelineGraph
              spec={pipeline.spec}
              onAgentClick={setSelectedAgent}
              selectedAgentId={selectedAgent?.agent_id ?? null}
            />
          </ReactFlowProvider>
        </div>

        {/* Agent editor panel */}
        {selectedAgent && (
          <AgentCard
            agent={selectedAgent}
            onUpdate={handleAgentUpdate}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </div>

      {/* Pipeline info + MetaBlock */}
      <div className="border-t border-white/6 px-4 py-6 sm:px-6 bg-zinc-950/50">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Zap className="size-3" />
              {pipeline.spec.triggers.map((t) => (
                <Badge key={t} variant="default">{t}</Badge>
              ))}
            </span>
            <span className="flex items-center gap-1.5">
              <Bot className="size-3" />
              {pipeline.spec.agents.length} agents
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="size-3" />
              <select
                value={pipeline.spec.model ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  updateSpec({ ...pipeline.spec, model: val });
                }}
                className="rounded-md bg-zinc-800/80 ring-1 ring-white/8 px-2 py-0.5 text-xs text-zinc-300 outline-none focus:ring-blue-500/50 border-0 cursor-pointer"
              >
                <option value="">Global Default</option>
                <option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku</option>
                <option value="claude-sonnet-4-5-20250929">Claude 4.5 Sonnet</option>
                <option value="claude-sonnet-4-6">Claude 4.6 Sonnet</option>
                <option value="claude-opus-4-6">Claude 4.6 Opus</option>
              </select>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3" />
              Created {formatDate(pipeline.created_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3" />
              Updated {formatDate(pipeline.updated_at)}
            </span>
          </div>
          {pipeline.spec.triggers.includes("webhook") && (
            <div className="rounded-xl ring-1 ring-white/6 bg-zinc-900/60 px-4 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <Webhook className="size-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Webhook URL
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-800/60 px-2 py-1 text-xs text-emerald-300 font-mono select-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/api/webhooks/${pipelineId}`
                    : `/api/webhooks/${pipelineId}`}
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/webhooks/${pipelineId}`;
                    navigator.clipboard.writeText(url);
                    setWebhookCopied(true);
                    setTimeout(() => setWebhookCopied(false), 2000);
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <Copy className="size-3" />
                  {webhookCopied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Integration instructions */}
              <details className="group">
                <summary className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors list-none">
                  <svg className="size-3 chevron-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  How to connect your external system
                </summary>
                <div className="mt-2 space-y-2 text-xs text-zinc-500 bg-zinc-800/40 rounded-lg p-3">
                  <p className="font-medium text-zinc-400">
                    Configure your system to send a POST request to this URL with a JSON body:
                  </p>
                  <code className="block bg-zinc-950/60 rounded-lg p-2.5 text-emerald-400/80 text-[11px] font-mono whitespace-pre">
{`POST ${typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/${pipelineId}` : `/api/webhooks/${pipelineId}`}
Content-Type: application/json

{
  "field1": "value",
  "field2": "value"
}`}
                  </code>
                  <p>
                    The pipeline will execute automatically each time it receives a valid payload.
                  </p>
                </div>
              </details>
            </div>
          )}
          <MetaBlock meta={pipeline.spec.meta} />
        </div>
      </div>

      <DeletePipelineDialog
        pipeline={pipeline}
        isOpen={showDeleteDialog}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!isDeleting) setShowDeleteDialog(false); }}
      />

      {/* Unsaved changes bar */}
      {hasUnsavedChanges && (
        <div className="sticky bottom-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-amber-500/20 bg-amber-500/5 backdrop-blur-xl px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertCircle className="size-4" />
            Unsaved changes
          </div>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-sm text-red-400">{saveError}</span>
            )}
            <button
              onClick={handleDiscard}
              className="rounded-lg ring-1 ring-white/8 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-linear-to-b from-blue-500 to-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-200 disabled:opacity-40"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Pipeline
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
