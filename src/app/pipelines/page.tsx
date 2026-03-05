"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { PipelineRecord } from "@/types/pipeline";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import {
  GitBranch,
  Bot,
  Copy,
  ArrowRight,
  AlertCircle,
  Plus,
} from "lucide-react";


function PipelineCard({
  pipeline,
  onDuplicate,
}: {
  pipeline: PipelineRecord;
  onDuplicate: (id: string) => void;
}) {
  return (
    <Card hover className="p-5 group">
      {/* Hover accent strip */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-linear-to-b from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

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
          <span className="flex items-center gap-1">
            <Bot className="size-3" />
            {pipeline.spec.agents.length} agents
          </span>
          <span className="text-zinc-700">|</span>
          {pipeline.spec.triggers.map((t) => (
            <Badge key={t} variant="default">{t}</Badge>
          ))}
          <span className="ml-auto">{formatDate(pipeline.created_at)}</span>
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <Link
          href={`/pipelines/${pipeline.id}`}
          className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Inspect
          <ArrowRight className="size-3" />
        </Link>
        <button
          onClick={() => onDuplicate(pipeline.id)}
          className="flex items-center gap-1.5 rounded-lg ring-1 ring-white/8 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          <Copy className="size-3" />
          Duplicate
        </button>
      </div>
    </Card>
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          icon={<GitBranch className="size-4" />}
          title="Your Pipelines"
          description="Manage and inspect your generated agent pipelines."
          actions={
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl bg-linear-to-b from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:from-blue-400 hover:to-blue-500"
            >
              <Plus className="size-3.5" />
              New Pipeline
            </Link>
          }
        />

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} className="h-36" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-xl ring-1 ring-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {!isLoading && !error && pipelines.length === 0 && (
          <EmptyState
            icon={<GitBranch className="size-6" />}
            title="No pipelines yet"
            description="Generate your first AI agent pipeline from a natural language description."
            actionLabel="Generate your first pipeline"
            actionHref="/"
          />
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
