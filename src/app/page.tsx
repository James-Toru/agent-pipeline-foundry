"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  HelpCircle,
  SkipForward,
} from "lucide-react";

type GenerateResult =
  | { success: true; spec: PipelineSpec }
  | { success: false; error: string };

type GenerateState =
  | "idle"
  | "analysing"
  | "clarifying"
  | "generating"
  | "done"
  | "error";

interface ClarifyQuestion {
  id: string;
  question: string;
  reason: string;
  type: "text" | "select" | "multiselect";
  placeholder?: string;
  options?: string[];
}

function GeneratePageInner() {
  const searchParams = useSearchParams();
  const discoveryPrompt = searchParams.get("prompt");
  const focusTextarea = searchParams.get("focus") === "true";

  const [input, setInput] = useState(
    discoveryPrompt ? decodeURIComponent(discoveryPrompt) : ""
  );

  useEffect(() => {
    if (focusTextarea) {
      const textarea = document.querySelector("textarea");
      textarea?.focus();
    }
  }, [focusTextarea]);

  const [genState, setGenState] = useState<GenerateState>("idle");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedPipelineId, setSavedPipelineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  async function runGenerate(promptText: string) {
    setGenState("generating");
    setResult(null);
    setSaveSuccess(false);
    setError(null);
    setProgress({ step: "Starting…", percent: 0 });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: promptText.trim() }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("text/event-stream")) {
        const data = await res.json();
        setResult({ success: false, error: data.error || "Generation failed." });
        setGenState("error");
        return;
      }

      if (!res.body) {
        setError("No response body received.");
        setGenState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

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
            setGenState("done");
          } else if (data.type === "error") {
            setResult({ success: false, error: data.error! });
            setGenState("error");
          }
        }
      }

      // If we finished reading but never got a complete/error event
      if (genState === "generating") {
        setGenState("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setGenState("error");
    }
  }

  async function handleGenerate() {
    if (!input.trim()) return;

    setGenState("analysing");
    setResult(null);
    setSaveSuccess(false);
    setError(null);
    setQuestions([]);
    setAnswers({});

    try {
      const res = await fetch("/api/generate/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input.trim() }),
      });
      const analysis = await res.json();

      if (analysis.ready) {
        await runGenerate(input);
      } else {
        setQuestions(analysis.questions ?? []);
        setGenState("clarifying");
      }
    } catch {
      // On analysis failure, proceed to generate directly
      await runGenerate(input);
    }
  }

  function handleSubmitAnswers() {
    const answerBlock = questions
      .map(
        (q) =>
          `${q.question}\nAnswer: ${answers[q.id] || "Not specified"}`
      )
      .join("\n\n");

    const enriched = `${input}\n\nAdditional details:\n${answerBlock}`;
    runGenerate(enriched);
  }

  function handleSkipClarification() {
    runGenerate(input);
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
        const saved = await res.json();
        setSavedPipelineId(saved.id);
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

  const isWorking = genState === "analysing" || genState === "generating";

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
          {discoveryPrompt && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-400 text-sm">&#x2728;</span>
              <span className="text-sm text-emerald-300 flex-1">
                Pre-filled from Workflow Discovery
              </span>
              <button
                onClick={() => setInput("")}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your workflow in natural language..."
            rows={6}
            disabled={isWorking || genState === "clarifying"}
            className="w-full resize-none rounded-xl border-0 ring-1 ring-white/8 bg-zinc-900/80 backdrop-blur-sm px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-60"
          />
          {!discoveryPrompt && input.trim() === "" && genState === "idle" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30">
              <span className="text-lg">&#x1F9ED;</span>
              <p className="text-sm text-zinc-400 flex-1">
                Not sure what to automate?
              </p>
              <Link
                href="/discover"
                className="text-sm text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap transition-colors"
              >
                Try Workflow Discovery &rarr;
              </Link>
            </div>
          )}

          {/* Generate / Analysing button */}
          {genState !== "clarifying" && (
            <button
              onClick={handleGenerate}
              disabled={isWorking || !input.trim()}
              className="w-full rounded-xl bg-linear-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {genState === "analysing" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analysing prompt...
                </>
              ) : genState === "generating" ? (
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
          )}
        </div>

        {/* Clarification Card */}
        {genState === "clarifying" && questions.length > 0 && (
          <div className="mt-6 animate-fade-up">
            <Card className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <HelpCircle className="size-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">
                    A few quick questions
                  </h3>
                  <p className="text-xs text-zinc-500">
                    This helps generate a more accurate pipeline for your use case.
                  </p>
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-5">
                {questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <p className="text-white text-sm font-medium">
                      {q.question}
                    </p>
                    <p className="text-zinc-500 text-xs italic">
                      {q.reason}
                    </p>

                    {q.type === "text" && (
                      <input
                        className="w-full rounded-lg ring-1 ring-white/8 bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all border-0"
                        placeholder={q.placeholder || "Type your answer..."}
                        value={answers[q.id] || ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                      />
                    )}

                    {q.type === "select" && q.options && (
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [q.id]: opt,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              answers[q.id] === opt
                                ? "bg-emerald-600 text-white ring-1 ring-emerald-500/50"
                                : "bg-zinc-800 text-zinc-400 ring-1 ring-white/6 hover:bg-zinc-700 hover:text-zinc-300"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === "multiselect" && q.options && (
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => {
                          const selected = (answers[q.id] || "")
                            .split("||")
                            .filter(Boolean);
                          const isSelected = selected.includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => {
                                const next = isSelected
                                  ? selected.filter((s) => s !== opt)
                                  : [...selected, opt];
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: next.join("||"),
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isSelected
                                  ? "bg-emerald-600 text-white ring-1 ring-emerald-500/50"
                                  : "bg-zinc-800 text-zinc-400 ring-1 ring-white/6 hover:bg-zinc-700 hover:text-zinc-300"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleSubmitAnswers}
                  className="w-full rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Wand2 className="size-4" />
                  Generate Pipeline
                </button>
                <button
                  onClick={handleSkipClarification}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                >
                  <SkipForward className="size-3" />
                  Skip and generate anyway
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* Progress bar */}
        {genState === "generating" && progress && (
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

        {/* Analysing status */}
        {genState === "analysing" && (
          <div className="mt-4 rounded-xl ring-1 ring-white/6 bg-zinc-900/60 px-4 py-3 animate-fade-up">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Checking your prompt...</span>
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
                    href={`/pipelines/${savedPipelineId}`}
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

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-zinc-600" />
        </div>
      }
    >
      <GeneratePageInner />
    </Suspense>
  );
}
