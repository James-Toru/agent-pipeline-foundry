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
import DeletePipelineDialog from "@/components/pipeline/DeletePipelineDialog";


function PipelineCard({
  pipeline,
  onDuplicate,
  onDelete,
}: {
  pipeline: PipelineRecord;
  onDuplicate: (id: string) => void;
  onDelete: (pipeline: PipelineRecord) => void;
}) {
  return (
    <Card hover className="p-5 group">
      {/* Hover accent strip */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-linear-to-b from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Trash icon — top right, inside card bounds */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(pipeline); }}
        className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 opacity-0 group-hover:opacity-100"
        aria-label="Delete pipeline"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3,6 5,6 21,6" />
          <path d="M19,6l-1,14H6L5,6" />
          <path d="M10,11v6M14,11v6" />
          <path d="M9,6V4h6v2" />
        </svg>
      </button>

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
  const [deletingPipeline, setDeletingPipeline] = useState<PipelineRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filtered = pipelines.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, filtered.length);

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

  async function handleDeleteConfirm() {
    if (!deletingPipeline) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/pipelines/${deletingPipeline.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete pipeline");
      }
      setPipelines((prev) => prev.filter((p) => p.id !== deletingPipeline.id));
      setDeletingPipeline(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete pipeline"
      );
    } finally {
      setIsDeleting(false);
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

        {!isLoading && pipelines.length > 0 && (
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search pipelines..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        )}

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

        {deleteError && (
          <div className="flex items-center justify-between rounded-xl ring-1 ring-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-4 shrink-0" />
              Failed to delete pipeline: {deleteError}
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

        {!isLoading && !error && pipelines.length === 0 && (
          <EmptyState
            icon={<GitBranch className="size-6" />}
            title="No pipelines yet"
            description="Generate your first AI agent pipeline from a natural language description."
            actionLabel="Generate your first pipeline"
            actionHref="/"
          />
        )}

        {!isLoading && pipelines.length > 0 && filtered.length === 0 && search && (
          <div className="text-center py-12">
            <p className="text-sm text-zinc-500">No pipelines match your search.</p>
          </div>
        )}

        {!isLoading && paginated.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {paginated.map((p) => (
                <PipelineCard
                  key={p.id}
                  pipeline={p}
                  onDuplicate={handleDuplicate}
                  onDelete={setDeletingPipeline}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
                <span className="text-sm text-zinc-500">
                  Showing {start}&ndash;{end} of {filtered.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-700 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:border-zinc-500 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-700 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:border-zinc-500 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DeletePipelineDialog
        pipeline={deletingPipeline}
        isOpen={deletingPipeline !== null}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!isDeleting) setDeletingPipeline(null); }}
      />
    </div>
  );
}
