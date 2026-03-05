"use client";

import { useState } from "react";
import Link from "next/link";
import type { PipelineSpec } from "@/types/pipeline";

type ProgressState = { step: string; percent: number };
import MetaBlock from "@/components/generate/MetaBlock";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  GitBranch,
  Users,
} from "lucide-react";

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
  const [progress, setProgress] = useState<ProgressState | null>(null);

  async function handleGenerate() {
    if (!input.trim()) return;

    setIsGenerating(true);
    setResult(null);
    setSaveSuccess(false);
    setError(null);
    setProgress({ step: "Starting…", percent: 0 });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      // Non-streaming error (rate limit / validation) — route returns JSON
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("text/event-stream")) {
        const data = await res.json();
        setResult({ success: false, error: data.error || "Generation failed." });
        return;
      }

      if (!res.body) {
        setError("No response body received.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newline
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          let data: {
            type: string;
            step?: string;
            percent?: number;
            spec?: PipelineSpec;
            error?: string;
          };
          try {
            data = JSON.parse(event.slice(6));
          } catch {
            continue;
          }

          if (data.type === "progress") {
            setProgress({ step: data.step!, percent: data.percent! });
          } else if (data.type === "complete") {
            setProgress({ step: "Pipeline ready!", percent: 100 });
            setResult({ success: true, spec: data.spec! });
          } else if (data.type === "error") {
            setResult({ success: false, error: data.error! });
          }
        }
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
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Hero */}
        <div className="mb-10 text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 ring-1 ring-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400 mb-4">
            <Sparkles className="size-3" />
            AI Pipeline Generator
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Build your agent pipeline
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Describe a workflow. Get a production-grade multi-agent pipeline.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-4 animate-fade-up-delay-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your workflow in natural language..."
            rows={6}
            className="w-full resize-none rounded-xl border-0 ring-1 ring-white/8 bg-zinc-900/80 backdrop-blur-sm px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !input.trim()}
            className="w-full rounded-xl bg-linear-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating pipeline...
              </>
            ) : (
              <>
                <Wand2 className="size-4" />
                Generate Pipeline
              </>
            )}
          </button>
        </div>

        {/* Progress bar */}
        {isGenerating && progress && (
          <div className="mt-4 rounded-xl ring-1 ring-white/6 bg-zinc-900/60 px-4 py-3 space-y-2 animate-fade-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="size-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                <span>{progress.step}</span>
              </div>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">
                {progress.percent}%
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-blue-600 to-blue-400 shadow-sm shadow-blue-500/40 transition-all duration-500 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl ring-1 ring-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-fade-up">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Failed result */}
        {result && !result.success && (
          <div className="mt-6 flex items-start gap-3 rounded-xl ring-1 ring-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-fade-up">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            {result.error}
          </div>
        )}

        {/* Success result */}
        {result && result.success && (
          <div className="mt-8 space-y-8 animate-fade-up">
            {/* Meta Block */}
            <MetaBlock meta={result.spec.meta} />

            {/* Pipeline Overview */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                <GitBranch className="size-3.5" />
                Pipeline Overview
              </h3>
              <Card className="p-5 space-y-4">
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
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {result.spec.triggers.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </section>

            {/* Agents */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                <Users className="size-3.5" />
                Agents ({result.spec.agents.length})
              </h3>
              <div className="space-y-3">
                {result.spec.agents.map((agent) => (
                  <Card key={agent.agent_id} hover className="px-5 py-4 border-l-2 border-blue-500/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-medium text-white">
                          {agent.role}
                        </span>
                        <Badge variant="info">{agent.archetype}</Badge>
                      </div>
                      {agent.requires_approval && (
                        <Badge variant="warning">Approval Required</Badge>
                      )}
                    </div>
                    {agent.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {agent.tools.map((tool) => (
                          <Badge key={tool} variant="default">
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>

            {/* Flow */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                <ArrowRight className="size-3.5" />
                Execution Flow
              </h3>
              <Card className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  {result.spec.orchestration.flow.map((edge, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="font-mono text-zinc-500">
                          {edge.from}
                        </span>
                      )}
                      <ChevronRight className="size-3 text-zinc-600" />
                      <span className="font-mono text-zinc-300">
                        {edge.to}
                      </span>
                    </span>
                  ))}
                </div>
                {result.spec.orchestration.parallel_groups.length > 0 && (
                  <div className="mt-3 border-t border-white/6 pt-3">
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
              </Card>
            </section>

            {/* Save */}
            <div className="pt-4">
              {saveSuccess ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl ring-1 ring-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                    Pipeline &ldquo;{result.spec.name}&rdquo; saved successfully.
                  </div>
                  <Link
                    href={`/pipelines/${result.spec.pipeline_id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 px-6 py-3 text-sm font-medium text-white ring-1 ring-white/8 shadow-lg transition-all duration-200"
                  >
                    Inspect Pipeline
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Save Pipeline
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
