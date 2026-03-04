"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PipelineRecord, DataField } from "@/types/pipeline";

export default function NewRunPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pipelineId = searchParams.get("pipeline");

  const [pipeline, setPipeline] = useState<PipelineRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!pipelineId) {
      setError("No pipeline specified.");
      setIsLoading(false);
      return;
    }

    async function fetchPipeline() {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}`);
        if (!res.ok) throw new Error("Pipeline not found");
        const data = await res.json();
        setPipeline(data.pipeline);

        // Initialize form with empty values for each input field
        const initial: Record<string, string> = {};
        for (const key of Object.keys(data.pipeline.spec.input_schema)) {
          initial[key] = "";
        }
        setFormData(initial);
      } catch {
        setError("Failed to load pipeline.");
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

  async function handleStart() {
    if (!pipeline || !pipelineId) return;

    // Validate required fields
    const schema = pipeline.spec.input_schema;
    for (const [key, field] of Object.entries(schema)) {
      if (field.required && !formData[key]?.trim()) {
        setError(`"${key}" is required.`);
        return;
      }
    }

    setIsStarting(true);
    setError(null);

    try {
      // Coerce form data to proper types
      const input_data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (schema[key]) {
          input_data[key] = coerceValue(value, schema[key]);
        }
      }

      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, input_data }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start run");
      }

      const data = await res.json();
      router.push(`/runs/${data.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run.");
      setIsStarting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-lg">{error || "Pipeline not found."}</p>
        <Link
          href="/pipelines"
          className="mt-3 text-sm text-zinc-400 hover:text-white"
        >
          Back to pipelines &rarr;
        </Link>
      </div>
    );
  }

  const inputFields = Object.entries(pipeline.spec.input_schema);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <Link
            href={`/pipelines/${pipelineId}`}
            className="text-sm text-zinc-500 hover:text-white"
          >
            &larr; Back to pipeline
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-white">
            Run: {pipeline.spec.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {pipeline.spec.description}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {inputFields.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-6 text-center">
              <p className="text-sm text-zinc-400">
                This pipeline has no input fields. Click below to start the run.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Pipeline Inputs
              </h2>
              {inputFields.map(([key, field]) => (
                <div key={key}>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
                    {key}
                    {field.required && (
                      <span className="text-xs text-red-400">*</span>
                    )}
                    <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
                      {field.type}
                    </span>
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
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
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
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none"
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
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {/* Pipeline info */}
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>{pipeline.spec.agents.length} agents</span>
            <span>
              Triggers:{" "}
              {pipeline.spec.triggers.map((t) => (
                <span
                  key={t}
                  className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400"
                >
                  {t}
                </span>
              ))}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Start button */}
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            {isStarting ? "Starting Run..." : "Start Pipeline Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
