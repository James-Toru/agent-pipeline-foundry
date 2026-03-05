"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PipelineRunStatus } from "@/types/pipeline";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { PlayCircle, ChevronRight } from "lucide-react";

interface RunRecord {
  id: string;
  pipeline_id: string;
  status: PipelineRunStatus;
  input_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  pipelines: { name: string } | null;
}

const STATUS_STYLES: Record<string, { dot: string; text: string; ping?: boolean }> = {
  pending: { dot: "bg-zinc-500", text: "text-zinc-400" },
  running: { dot: "bg-blue-400", text: "text-blue-400", ping: true },
  paused: { dot: "bg-amber-400", text: "text-amber-400", ping: true },
  completed: { dot: "bg-emerald-400", text: "text-emerald-400" },
  failed: { dot: "bg-red-400", text: "text-red-400" },
};


export default function RunsListPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch("/api/runs");
        if (!res.ok) throw new Error("Failed to fetch runs");
        const data = await res.json();
        setRuns(data.runs ?? []);
      } catch (err) {
        console.error("Failed to load runs:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRuns();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          icon={<PlayCircle className="size-4" />}
          title="Pipeline Runs"
          description="All pipeline executions and their statuses."
        />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} className="h-18" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={<PlayCircle className="size-6" />}
            title="No runs yet"
            description="Start a run from the Pipelines page to see execution results here."
            actionLabel="Go to Pipelines"
            actionHref="/pipelines"
          />
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;
              return (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="group flex items-center justify-between rounded-xl ring-1 ring-white/6 bg-zinc-900/80 px-5 py-4 transition-all duration-200 hover:ring-white/12 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20"
                >
                  <div className="flex items-center gap-3">
                    {/* Status dot with optional ping */}
                    <span className="relative flex h-2.5 w-2.5">
                      {style.ping && (
                        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${style.dot} opacity-50`} />
                      )}
                      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    </span>
                    <div>
                      <span className="text-sm font-medium text-white">
                        {run.pipelines?.name ?? "Unknown Pipeline"}
                      </span>
                      <span className="ml-3 font-mono text-xs text-zinc-600">
                        {run.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs capitalize ${style.text}`}>
                      {run.status}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {formatDateTime(run.started_at)}
                    </span>
                    <ChevronRight className="size-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
