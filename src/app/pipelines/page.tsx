"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PipelineRecord } from "@/types/pipeline";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PipelineCard({
  pipeline,
  onDuplicate,
}: {
  pipeline: PipelineRecord;
  onDuplicate: (id: string) => void;
}) {
  return (
    <div className="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-600">
      <Link href={`/pipelines/${pipeline.id}`}>
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
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <Link
          href={`/pipelines/${pipeline.id}`}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
        >
          Inspect &rarr;
        </Link>
        <button
          onClick={() => onDuplicate(pipeline.id)}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          Duplicate
        </button>
      </div>
    </div>
  );
}

export default function PipelinesPage() {
  const router = useRouter();
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

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/pipelines/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to duplicate");
      const data = await res.json();
      router.push(`/pipelines/${data.pipeline.id}`);
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  }

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
              <PipelineCard key={p.id} pipeline={p} onDuplicate={handleDuplicate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
