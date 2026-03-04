"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReactFlowProvider } from "@xyflow/react";
import type { PipelineRecord, AgentSpec, PipelineSpec } from "@/types/pipeline";
import PipelineGraph from "@/components/pipeline/PipelineGraph";
import AgentCard from "@/components/pipeline/AgentCard";
import MetaBlock from "@/components/generate/MetaBlock";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PipelineInspectorPage() {
  const params = useParams<{ id: string }>();
  const pipelineId = params.id;

  const [pipeline, setPipeline] = useState<PipelineRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentSpec | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notFound, setNotFound] = useState(false);

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

  function handleDiscard() {
    setSelectedAgent(null);
    setHasUnsavedChanges(false);
    setIsLoading(true);
    fetchPipeline();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-lg">Pipeline not found.</p>
        <Link href="/pipelines" className="mt-3 text-sm text-zinc-400 hover:text-white">
          Back to pipelines &rarr;
        </Link>
      </div>
    );
  }

  if (!pipeline) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/pipelines"
            className="text-sm text-zinc-500 hover:text-white"
          >
            &larr; Pipelines
          </Link>
          <input
            type="text"
            value={pipeline.spec.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="bg-transparent text-lg font-semibold text-white outline-none focus:border-b focus:border-zinc-600"
          />
        </div>
        <Link
          href={`/runs/new?pipeline=${pipelineId}`}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          Run Pipeline
        </Link>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph */}
        <div className={`flex-1 p-4 ${selectedAgent ? "" : ""}`}>
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
      <div className="border-t border-zinc-800 px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex gap-6 text-xs text-zinc-500">
            <span>
              Trigger:{" "}
              {pipeline.spec.triggers.map((t) => (
                <span
                  key={t}
                  className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400"
                >
                  {t}
                </span>
              ))}
            </span>
            <span>{pipeline.spec.agents.length} agents</span>
            <span>Created {formatDate(pipeline.created_at)}</span>
            <span>Updated {formatDate(pipeline.updated_at)}</span>
          </div>
          <MetaBlock meta={pipeline.spec.meta} />
        </div>
      </div>

      {/* Unsaved changes bar */}
      {hasUnsavedChanges && (
        <div className="sticky bottom-0 flex items-center justify-between border-t border-amber-500/30 bg-amber-500/10 px-6 py-3">
          <span className="text-sm text-amber-400">
            You have unsaved changes
          </span>
          <div className="flex gap-3">
            {saveError && (
              <span className="text-sm text-red-400">{saveError}</span>
            )}
            <button
              onClick={handleDiscard}
              className="rounded-lg border border-zinc-600 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40"
            >
              {isSaving ? "Saving..." : "Save Pipeline"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
