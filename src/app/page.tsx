"use client";

import { useState } from "react";
import Link from "next/link";
import type { PipelineSpec } from "@/types/pipeline";
import MetaBlock from "@/components/generate/MetaBlock";

type GenerateResult =
  | { success: true; spec: PipelineSpec }
  | { success: false; error: string };

export default function GeneratePage() {
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!input.trim()) return;

    setIsGenerating(true);
    setResult(null);
    setSaveSuccess(false);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.spec) {
        setResult({ success: true, spec: data.spec });
      } else {
        setResult({ success: false, error: data.error || "Generation failed." });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!result || !result.success) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: result.spec }),
      });

      if (res.ok) {
        setSaveSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save pipeline.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <p className="mt-2 text-sm text-zinc-500">
            Describe a workflow. Get a production-grade multi-agent pipeline.
          </p>
        </header>

        {/* Input */}
        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your workflow in natural language..."
            rows={6}
            className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !input.trim()}
            className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? "Generating..." : "Generate Pipeline"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Failed result */}
        {result && !result.success && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {result.error}
          </div>
        )}

        {/* Success result */}
        {result && result.success && (
          <div className="mt-8 space-y-8">
            {/* Meta Block */}
            <MetaBlock meta={result.spec.meta} />

            {/* Pipeline Preview */}
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Pipeline Overview
              </h3>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    Name
                  </span>
                  <p className="text-base font-medium text-white">
                    {result.spec.name}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    Description
                  </span>
                  <p className="text-sm text-zinc-300">
                    {result.spec.description}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    Triggers
                  </span>
                  <p className="text-sm text-zinc-300">
                    {result.spec.triggers.join(", ")}
                  </p>
                </div>
              </div>
            </section>

            {/* Agents */}
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Agents ({result.spec.agents.length})
              </h3>
              <div className="space-y-3">
                {result.spec.agents.map((agent) => (
                  <div
                    key={agent.agent_id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-medium text-white">
                          {agent.role}
                        </span>
                        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                          {agent.archetype}
                        </span>
                      </div>
                      {agent.requires_approval && (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400 border border-amber-500/20">
                          Approval Required
                        </span>
                      )}
                    </div>
                    {agent.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {agent.tools.map((tool) => (
                          <span
                            key={tool}
                            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Flow */}
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Execution Flow
              </h3>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  {result.spec.orchestration.flow.map((edge, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="font-mono text-zinc-500">
                          {edge.from}
                        </span>
                      )}
                      <span className="text-zinc-600">&rarr;</span>
                      <span className="font-mono text-zinc-300">
                        {edge.to}
                      </span>
                    </span>
                  ))}
                </div>
                {result.spec.orchestration.parallel_groups.length > 0 && (
                  <div className="mt-3 border-t border-zinc-800 pt-3">
                    <span className="text-xs uppercase tracking-wider text-zinc-500">
                      Parallel Groups
                    </span>
                    {result.spec.orchestration.parallel_groups.map(
                      (group, i) => (
                        <p key={i} className="mt-1 text-sm text-zinc-400">
                          [{group.join(", ")}]
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Save */}
            <div className="pt-4">
              {saveSuccess ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    Pipeline &ldquo;{result.spec.name}&rdquo; saved successfully.
                  </div>
                  <Link
                    href={`/pipelines/${result.spec.pipeline_id}`}
                    className="block w-full rounded-lg bg-white px-6 py-3 text-center text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
                  >
                    Inspect Pipeline &rarr;
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSaving ? "Saving..." : "Save Pipeline"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
