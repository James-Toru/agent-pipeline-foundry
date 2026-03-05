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
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { cn } from "@/lib/utils";
import {
  BarChart2,
  Activity,
  CheckCircle2,
  Cpu,
  Timer,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

type BadgeVariant = "default" | "success" | "error" | "info" | "warning";

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

const STATUS_BADGE: Record<string, BadgeVariant> = {
  completed: "success",
  failed: "error",
  running: "info",
  paused: "warning",
  pending: "default",
};

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

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-48 rounded-lg skeleton-shimmer mb-8" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-28" />)}
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <SkeletonCard className="h-72" />
            <SkeletonCard className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <PageHeader
          icon={<BarChart2 className="size-4" />}
          title="Analytics"
          description="Pipeline execution metrics and token usage."
          actions={
            <div className="flex gap-1 rounded-xl ring-1 ring-white/6 bg-zinc-900 p-1">
              {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
                    period === p
                      ? "bg-zinc-700 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {p === "all" ? "All Time" : p.toUpperCase()}
                </button>
              ))}
            </div>
          }
        />

        {/* Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Activity className="size-4" />}
              label="Total Runs"
              value={stats.total_runs.toString()}
              subtext={`${stats.completed_runs} completed, ${stats.failed_runs} failed`}
            />
            <StatCard
              icon={<CheckCircle2 className="size-4" />}
              label="Success Rate"
              value={`${stats.success_rate}%`}
              subtext={`${stats.total_pipelines} pipelines`}
            />
            <StatCard
              icon={<Cpu className="size-4" />}
              label="Tokens Used"
              value={formatTokens(stats.total_tokens)}
              subtext={formatCost(stats.total_cost_usd)}
            />
            <StatCard
              icon={<Timer className="size-4" />}
              label="Avg Duration"
              value={formatDuration(stats.avg_duration_ms)}
            />
          </div>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
                <TrendingUp className="size-3.5" />
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
                      borderRadius: 12,
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
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
                <BarChart2 className="size-3.5" />
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
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Bar dataKey="runs" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Run History Table */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Run History
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl ring-1 ring-white/6 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 outline-none border-0"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-xl ring-1 ring-white/6">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/6 bg-zinc-900/60 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Pipeline</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Tokens</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Cost</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Duration</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 bg-zinc-950">
                {runs.map((run) => {
                  const badgeVariant = STATUS_BADGE[run.status] ?? "default";
                  return (
                    <tr key={run.id} className="transition-colors hover:bg-zinc-900/60">
                      <td className="px-4 py-3">
                        <Link href={`/runs/${run.id}`} className="text-zinc-200 hover:text-white transition-colors">
                          {run.pipelines?.name ?? run.pipeline_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant} dot>{run.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {run.total_tokens != null ? formatTokens(run.total_tokens) : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {run.total_cost_usd != null ? formatCost(parseFloat(run.total_cost_usd)) : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {run.duration_ms != null ? formatDuration(run.duration_ms) : "-"}
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
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
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
                  className="flex items-center gap-1 rounded-lg ring-1 ring-white/6 px-3 py-1 transition-colors hover:bg-zinc-800 disabled:opacity-30"
                >
                  <ChevronLeft className="size-3" />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                  disabled={page === pagination.total_pages}
                  className="flex items-center gap-1 rounded-lg ring-1 ring-white/6 px-3 py-1 transition-colors hover:bg-zinc-800 disabled:opacity-30"
                >
                  Next
                  <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
