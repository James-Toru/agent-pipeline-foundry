"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Compass,
  ArrowLeft,
  ArrowRight,
  Bot,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Info,
  Wrench,
  Clock,
  Zap,
  Play,
} from "lucide-react";
import {
  DEPARTMENTS,
  INTEGRATION_NAMES,
  type Department,
  type BusinessProblem,
} from "@/lib/discovery-data";

// ── Integration Status ───────────────────────────────────────────────────────

type IntegrationStatus = Record<string, { configured: boolean }>;

function useIntegrationStatus() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);
  return status;
}

// ── Department Grid ──────────────────────────────────────────────────────────

function DepartmentGrid({
  onSelect,
}: {
  onSelect: (d: Department) => void;
}) {
  return (
    <>
      <PageHeader
        icon={<Compass className="size-4" />}
        title="Workflow Discovery"
        description="Choose a department to explore pre-built automation workflows."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 animate-fade-up">
        {DEPARTMENTS.map((dept) => (
          <button key={dept.id} onClick={() => onSelect(dept)} className="text-left">
            <Card hover className="p-4 h-full">
              <span className="text-2xl">{dept.emoji}</span>
              <h3 className="mt-2 text-sm font-semibold text-white">
                {dept.name}
              </h3>
              <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                {dept.description}
              </p>
              <div className="mt-3">
                <Badge>
                  {dept.problems.length} workflow{dept.problems.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </>
  );
}

// ── Problem List ─────────────────────────────────────────────────────────────

function ProblemList({
  department,
  onBack,
  onSelect,
}: {
  department: Department;
  onBack: () => void;
  onSelect: (p: BusinessProblem) => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All departments
      </button>

      <PageHeader
        icon={<span className="text-lg">{department.emoji}</span>}
        title={department.name}
        description={department.description}
      />

      <div className="space-y-3 animate-fade-up">
        {department.problems.map((problem) => (
          <button
            key={problem.id}
            onClick={() => onSelect(problem)}
            className="w-full text-left"
          >
            <Card hover className="px-5 py-4">
              <p className="text-sm font-medium text-amber-300/90 italic">
                &ldquo;{problem.pain_point}&rdquo;
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                {problem.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {problem.integrations.map((int) => (
                  <Badge key={int} variant="info">
                    {INTEGRATION_NAMES[int] ?? int}
                  </Badge>
                ))}
                <span className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
                  <Bot className="size-3" />
                  {problem.agents_preview.length} agents
                </span>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </>
  );
}

// ── Pipeline Preview ─────────────────────────────────────────────────────────

function PipelinePreview({
  problem,
  onBack,
}: {
  problem: BusinessProblem;
  onBack: () => void;
}) {
  const router = useRouter();
  const integrationStatus = useIntegrationStatus();

  const requiredIntegrations = problem.integrations;
  const missingIntegrations = integrationStatus
    ? requiredIntegrations.filter(
        (id) => !integrationStatus[id]?.configured
      )
    : [];
  const allConnected =
    integrationStatus !== null && missingIntegrations.length === 0;

  function handleGenerate() {
    router.push(
      `/?prompt=${encodeURIComponent(problem.generate_prompt)}`
    );
  }

  function handleCustomise() {
    router.push(
      `/?prompt=${encodeURIComponent(problem.generate_prompt)}&focus=true`
    );
  }

  return (
    <>
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to problems
      </button>

      <PageHeader
        icon={<Bot className="size-4" />}
        title={problem.pain_point}
        description={problem.description}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 animate-fade-up">
        {/* LEFT COLUMN — Agents */}
        <div className="lg:col-span-3">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <Bot className="size-3.5" />
            Agents in this pipeline
          </h3>

          <div className="space-y-0">
            {problem.agents_preview.map((agent, i) => (
              <div key={i} className="relative flex gap-3">
                {/* Connector line */}
                {i < problem.agents_preview.length - 1 && (
                  <div className="absolute left-3.75 top-9.5 bottom-0 w-px bg-zinc-800" />
                )}

                {/* Number badge */}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-white/10 text-xs font-semibold text-zinc-300">
                  {i + 1}
                </div>

                {/* Agent info */}
                <div className="pb-5 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {agent.role}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {agent.description}
                  </p>
                  {agent.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {agent.tools.map((tool) => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500 ring-1 ring-white/6"
                        >
                          <Wrench className="size-2.5" />
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN — Summary */}
        <div className="lg:col-span-2">
          {/* Integrations required */}
          <Card className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Integrations required
              </h4>
              <div className="space-y-2">
                {requiredIntegrations.map((id) => {
                  const connected = integrationStatus?.[id]?.configured;
                  const loading = integrationStatus === null;
                  return (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      {loading ? (
                        <span className="size-3.5 rounded-full bg-zinc-700 animate-pulse" />
                      ) : connected ? (
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="size-3.5 text-amber-400" />
                      )}
                      <span className={connected ? "text-zinc-300" : "text-zinc-400"}>
                        {INTEGRATION_NAMES[id] ?? id}
                      </span>
                      {loading ? null : connected ? (
                        <span className="ml-auto text-[11px] text-emerald-400/70">
                          Connected
                        </span>
                      ) : (
                        <span className="ml-auto text-[11px] text-amber-400/70">
                          Not connected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {integrationStatus && !allConnected && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
                  <Info className="size-3.5 mt-0.5 shrink-0 text-amber-400" />
                  <div className="text-xs text-amber-300/80">
                    Some integrations are not connected. The pipeline will
                    simulate these tools.{" "}
                    <Link
                      href="/settings"
                      className="font-medium text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      Go to Settings &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline details */}
            <div className="border-t border-white/6 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Pipeline details
              </h4>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  {problem.trigger_type === "scheduled" ? (
                    <Clock className="size-3.5 text-blue-400" />
                  ) : problem.trigger_type === "event" ? (
                    <Zap className="size-3.5 text-amber-400" />
                  ) : (
                    <Play className="size-3.5 text-emerald-400" />
                  )}
                  <span>
                    {problem.trigger_type === "scheduled"
                      ? "Scheduled"
                      : problem.trigger_type === "event"
                        ? "Event-driven"
                        : "Manual trigger"}
                  </span>
                </div>
                <p className="pl-5.5 text-xs text-zinc-500">
                  {problem.trigger_description}
                </p>
                <div className="flex items-center gap-2">
                  <Bot className="size-3.5 text-zinc-600" />
                  {problem.agents_preview.length} agents
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="size-3.5 text-zinc-600" />
                  ~{problem.estimated_minutes} min estimated
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {problem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500 ring-1 ring-white/6"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="mt-8 space-y-3 animate-fade-up">
        <button
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-6 py-3.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
        >
          Generate This Pipeline
          <ArrowRight className="size-4" />
        </button>
        <button
          onClick={handleCustomise}
          className="flex w-full items-center justify-center gap-2 rounded-xl ring-1 ring-white/10 hover:ring-white/20 bg-zinc-900/80 hover:bg-zinc-800/80 px-6 py-3 text-sm font-medium text-zinc-300 transition-all duration-200"
        >
          Customise the prompt first
        </button>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type View =
  | { step: "departments" }
  | { step: "problems"; department: Department }
  | { step: "preview"; department: Department; problem: BusinessProblem };

export default function DiscoverPage() {
  const [view, setView] = useState<View>({ step: "departments" });

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        {view.step === "departments" && (
          <DepartmentGrid
            onSelect={(d) => setView({ step: "problems", department: d })}
          />
        )}

        {view.step === "problems" && (
          <ProblemList
            department={view.department}
            onBack={() => setView({ step: "departments" })}
            onSelect={(p) =>
              setView({
                step: "preview",
                department: view.department,
                problem: p,
              })
            }
          />
        )}

        {view.step === "preview" && (
          <PipelinePreview
            problem={view.problem}
            onBack={() =>
              setView({ step: "problems", department: view.department })
            }
          />
        )}
      </div>
    </div>
  );
}
