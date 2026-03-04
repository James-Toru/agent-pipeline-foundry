"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PipelineRecord } from "@/types/pipeline";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PipelineCard({ pipeline }: { pipeline: PipelineRecord }) {
  return (
    <Link
      href={`/pipelines/${pipeline.id}`}
      className="group block rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-600"
    >
      <h3 className="text-base font-medium text-white group-hover:text-zinc-200">
        {pipeline.name}
      </h3>
      {pipeline.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-zinc-400">
          {pipeline.description}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
        <span>{pipeline.spec.agents.length} agents</span>
        <span className="text-zinc-700">|</span>
        {pipeline.spec.triggers.map((t) => (
          <span
            key={t}
            className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400"
          >
            {t}
          </span>
        ))}
        <span className="ml-auto">{formatDate(pipeline.created_at)}</span>
      </div>
      <div className="mt-3 text-xs font-medium text-zinc-500 group-hover:text-zinc-300">
        Inspect &rarr;
      </div>
    </Link>
  );
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<PipelineRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPipelines() {
      try {
        const res = await fetch("/api/pipelines");
        if (!res.ok) throw new Error("Failed to fetch pipelines");
        const data = await res.json();
        setPipelines(data.pipelines ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pipelines.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchPipelines();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Your Pipelines
          </h1>
          <Link
            href="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            New Pipeline
          </Link>
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!isLoading && !error && pipelines.length === 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No pipelines yet.</p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium text-white hover:text-zinc-300"
            >
              Generate your first pipeline &rarr;
            </Link>
          </div>
        )}

        {!isLoading && pipelines.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {pipelines.map((p) => (
              <PipelineCard key={p.id} pipeline={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
