"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import {
  ChevronLeft,
  Play,
  Loader2,
  AlertCircle,
  Bot,
  Zap,
  Lock,
  Copy,
  ChevronDown,
} from "lucide-react";
import type { PipelineRecord, DataField } from "@/types/pipeline";

function NewRunForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pipelineId = searchParams.get("pipeline");

  const [pipeline, setPipeline] = useState<PipelineRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    action: string | null;
    integration: string | null;
    settings_url: string | null;
  } | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [testPayload, setTestPayload] = useState("");

  useEffect(() => {
    if (!pipelineId) {
      setError({ message: "No pipeline specified.", action: null, integration: null, settings_url: null });
      setIsLoading(false);
      return;
    }

    async function fetchPipeline() {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}`);
        if (!res.ok) throw new Error("Pipeline not found");
        const data = await res.json();
        setPipeline(data.pipeline);

        const initial: Record<string, string> = {};
        for (const key of Object.keys(data.pipeline.spec.input_schema)) {
          initial[key] = "";
        }
        setFormData(initial);
      } catch {
        setError({ message: "Failed to load pipeline.", action: null, integration: null, settings_url: null });
      } finally {
        setIsLoading(false);
      }
    }

    fetchPipeline();
  }, [pipelineId]);

  function coerceValue(value: string, field: DataField): unknown {
    switch (field.type) {
      case "number":
        return Number(value) || 0;
      case "boolean":
        return value.toLowerCase() === "true" || value === "1";
      case "object":
      case "array":
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  const isWebhookPipeline = pipeline?.spec.triggers.includes("webhook") ?? false;

  async function handleStart() {
    if (!pipeline || !pipelineId) return;

    setIsStarting(true);
    setError(null);

    try {
      let input_data: Record<string, unknown>;

      if (isWebhookPipeline) {
        // For webhook pipelines, use the test payload if provided
        if (testPayload.trim()) {
          try {
            input_data = JSON.parse(testPayload);
          } catch {
            setError({
              message: "Invalid JSON in test payload.",
              action: "Check your JSON syntax and try again.",
              integration: null,
              settings_url: null,
            });
            setIsStarting(false);
            return;
          }
        } else {
          input_data = { _test: true, _source: "manual_test" };
        }
      } else {
        const schema = pipeline.spec.input_schema;
        for (const [key, field] of Object.entries(schema)) {
          if (field.required && !formData[key]?.trim()) {
            setError({
              message: `"${key}" is required.`,
              action: "Fill in all required fields before starting the run.",
              integration: null,
              settings_url: null,
            });
            setIsStarting(false);
            return;
          }
        }

        input_data = {};
        for (const [key, value] of Object.entries(formData)) {
          if (schema[key]) {
            input_data[key] = coerceValue(value, schema[key]);
          }
        }
      }

      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, input_data }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError({
          message: data.error ?? "Failed to start run",
          action: data.action ?? null,
          integration: data.integration ?? null,
          settings_url: data.settings_url ?? null,
        });
        setIsStarting(false);
        return;
      }

      router.push(`/runs/${data.run.id}`);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Failed to connect to the server",
        action: "Check your internet connection and try again.",
        integration: null,
        settings_url: null,
      });
      setIsStarting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-2xl">
          <div className="h-8 w-48 rounded-lg skeleton-shimmer mb-8" />
          <SkeletonCard className="h-64" />
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-white/6 mb-4">
          <AlertCircle className="size-6 text-zinc-500" />
        </div>
        <p className="text-lg font-medium text-white">{error?.message || "Pipeline not found."}</p>
        <Link
          href="/pipelines"
          className="mt-3 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
        >
          <ChevronLeft className="size-3" />
          Back to pipelines
        </Link>
      </div>
    );
  }

  const inputFields = Object.entries(pipeline.spec.input_schema);
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/${pipelineId}`
    : `/api/webhooks/${pipelineId}`;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        {/* Back link */}
        <Link
          href={`/pipelines/${pipelineId}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Back to pipeline
        </Link>

        <PageHeader
          icon={<Play className="size-4" />}
          title={`Run: ${pipeline.spec.name}`}
          description={pipeline.spec.description}
        />

        <Card className="p-6">
          <div className="space-y-5">
            {isWebhookPipeline ? (
              /* WEBHOOK PIPELINE — no manual input form */
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl ring-1 ring-emerald-500/20 bg-emerald-500/8 px-4 py-3">
                  <Zap className="size-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">
                      This pipeline is triggered by webhook
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Data is received automatically from your external system. No manual input needed.
                    </p>
                  </div>
                </div>

                {/* Webhook URL */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    Webhook URL
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 min-w-0 truncate rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2.5 text-sm text-emerald-300 font-mono">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(webhookUrl)}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl ring-1 ring-white/8 bg-zinc-800 hover:bg-zinc-700 px-3 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      <Copy className="size-3.5" />
                      Copy
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-500">
                  Configure your external system to POST data to this URL. The pipeline will execute automatically each time it receives a payload.
                </p>

                {/* Test payload section */}
                <details className="group">
                  <summary className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors list-none">
                    <ChevronDown className="size-3.5 chevron-icon" />
                    Test with sample payload (development)
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-zinc-500">
                      Paste a sample webhook payload to test the pipeline without waiting for your external system.
                    </p>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      placeholder={`{\n  "subject": "Cannot login to account",\n  "description": "Getting error on login page",\n  "customer_email": "john@acme.com",\n  "priority": "High"\n}`}
                      rows={6}
                      className="w-full rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-300 font-mono outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200 border-0 resize-none"
                    />
                  </div>
                </details>
              </div>
            ) : inputFields.length === 0 ? (
              <div className="rounded-xl ring-1 ring-white/6 bg-zinc-800/50 px-5 py-6 text-center">
                <p className="text-sm text-zinc-400">
                  This pipeline has no input fields. Click below to start the run.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Pipeline Inputs
                </h2>
                {inputFields.map(([key, field]) => (
                  <div key={key}>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
                      {field.type === "object" || field.type === "array" ? (
                        <Lock className="size-3" />
                      ) : null}
                      {key}
                      {field.required && (
                        <span className="text-red-400">*</span>
                      )}
                      <Badge variant="default" className="ml-auto">{field.type}</Badge>
                    </label>
                    <p className="mb-2 text-xs text-zinc-500">
                      {field.description}
                    </p>
                    {field.type === "object" || field.type === "array" ? (
                      <textarea
                        value={formData[key] ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        rows={4}
                        placeholder={
                          field.type === "array" ? '["item1", "item2"]' : '{"key": "value"}'
                        }
                        className="w-full rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 border-0 resize-none"
                      />
                    ) : field.type === "boolean" ? (
                      <select
                        value={formData[key] ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 border-0"
                      >
                        <option value="">Select...</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={formData[key] ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder={`Enter ${key}...`}
                        className="w-full rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 border-0"
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Pipeline info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Bot className="size-3" />
                {pipeline.spec.agents.length} agents
              </span>
              <span className="flex items-center gap-1">
                <Zap className="size-3" />
                Triggers:
              </span>
              {pipeline.spec.triggers.map((t) => (
                <Badge key={t} variant="default">{t}</Badge>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="border border-red-500/50 bg-red-950/30 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="size-4 mt-0.5 shrink-0 text-red-400" />
                  <p className="text-red-300 text-sm font-medium">{error.message}</p>
                </div>
                {error.action && (
                  <p className="text-red-200/70 text-xs mt-2 ml-6">{error.action}</p>
                )}
                {error.settings_url && (
                  <Link
                    href={error.settings_url}
                    className="inline-block mt-2 ml-6 text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
                  >
                    Go to Settings &rarr;
                  </Link>
                )}
              </div>
            )}

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting Run...
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  {isWebhookPipeline ? "Start Test Run" : "Start Pipeline Run"}
                </>
              )}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function NewRunPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
          <div className="mx-auto max-w-2xl">
            <div className="h-8 w-48 rounded-lg skeleton-shimmer mb-8" />
            <SkeletonCard className="h-64" />
          </div>
        </div>
      }
    >
      <NewRunForm />
    </Suspense>
  );
}
