"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  success_rate: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_duration_ms: number;
  total_pipelines: number;
}

interface ChartPoint {
  date: string;
  tokens: number;
  cost: number;
  runs: number;
}

interface RunRow {
  id: string;
  pipeline_id: string;
  status: string;
  total_tokens: number | null;
  total_cost_usd: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
  pipelines: { name: string } | null;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

type Period = "7d" | "30d" | "90d" | "all";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  completed: { dot: "bg-emerald-400", text: "text-emerald-400" },
  failed: { dot: "bg-red-400", text: "text-red-400" },
  running: { dot: "bg-blue-400", text: "text-blue-400" },
  paused: { dot: "bg-amber-400", text: "text-amber-400" },
  pending: { dot: "bg-zinc-500", text: "text-zinc-400" },
};

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics?period=${period}`);
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
      setChartData(data.chart_data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  }, [period]);

  const fetchRuns = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: "15",
        sort: "started_at",
        order: "desc",
      });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/analytics/runs?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setRuns(data.runs);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to fetch runs:", err);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchStats(), fetchRuns()]).finally(() => setIsLoading(false));
  }, [fetchStats, fetchRuns]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  if (isLoading && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Analytics</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Pipeline execution metrics and token usage.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {p === "all" ? "All Time" : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Runs"
              value={stats.total_runs.toString()}
              sub={`${stats.completed_runs} completed, ${stats.failed_runs} failed`}
            />
            <StatCard
              label="Success Rate"
              value={`${stats.success_rate}%`}
              sub={`${stats.total_pipelines} pipelines`}
            />
            <StatCard
              label="Tokens Used"
              value={formatTokens(stats.total_tokens)}
              sub={formatCost(stats.total_cost_usd)}
            />
            <StatCard
              label="Avg Duration"
              value={formatDuration(stats.avg_duration_ms)}
            />
          </div>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Token usage chart */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-4 text-sm font-medium text-zinc-400">
                Daily Token Usage
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    tickFormatter={formatTokens}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                    formatter={(value?: number | string) => [
                      formatTokens(Number(value ?? 0)),
                      "Tokens",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="tokens"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Runs per day chart */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-4 text-sm font-medium text-zinc-400">
                Runs per Day
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Bar dataKey="runs" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Run History Table */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Run History
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Pipeline
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {runs.map((run) => {
                  const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;
                  return (
                    <tr
                      key={run.id}
                      className="transition-colors hover:bg-zinc-900"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/runs/${run.id}`}
                          className="text-zinc-200 hover:text-white"
                        >
                          {run.pipelines?.name ?? run.pipeline_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 ${style.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {run.total_tokens != null
                          ? formatTokens(run.total_tokens)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {run.total_cost_usd != null
                          ? formatCost(parseFloat(run.total_cost_usd))
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {run.duration_ms != null
                          ? formatDuration(run.duration_ms)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(run.started_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
                {runs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-zinc-600"
                    >
                      No runs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>
                Showing {(page - 1) * pagination.per_page + 1}–
                {Math.min(page * pagination.per_page, pagination.total)} of{" "}
                {pagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border border-zinc-700 px-3 py-1 transition-colors hover:bg-zinc-800 disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(pagination.total_pages, p + 1))
                  }
                  disabled={page === pagination.total_pages}
                  className="rounded border border-zinc-700 px-3 py-1 transition-colors hover:bg-zinc-800 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
