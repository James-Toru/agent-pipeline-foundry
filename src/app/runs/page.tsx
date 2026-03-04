"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PipelineRunStatus } from "@/types/pipeline";

interface RunRecord {
  id: string;
  pipeline_id: string;
  status: PipelineRunStatus;
  input_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  pipelines: { name: string } | null;
}

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  pending: { dot: "bg-zinc-500", text: "text-zinc-400" },
  running: { dot: "bg-blue-400 animate-pulse", text: "text-blue-400" },
  paused: { dot: "bg-amber-400 animate-pulse", text: "text-amber-400" },
  completed: { dot: "bg-emerald-400", text: "text-emerald-400" },
  failed: { dot: "bg-red-400", text: "text-red-400" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold text-white">Pipeline Runs</h1>
        <p className="mt-1 text-sm text-zinc-500">
          All pipeline executions and their statuses.
        </p>

        {isLoading ? (
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
              />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-zinc-500">No runs yet.</p>
            <Link
              href="/pipelines"
              className="mt-2 inline-block text-sm text-zinc-400 hover:text-white"
            >
              Go to pipelines to start a run &rarr;
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {runs.map((run) => {
              const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;
              return (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
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
                      {formatDate(run.started_at)}
                    </span>
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
