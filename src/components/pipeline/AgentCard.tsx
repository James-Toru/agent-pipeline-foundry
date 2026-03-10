"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentSpec,
  ToolId,
  OnFailurePolicy,
} from "@/types/pipeline";
import { Badge } from "@/components/ui/badge";
import {
  X,
  FileText,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Cpu,
  ArrowDownToLine,
  ArrowUpFromLine,
  Save,
  Check,
} from "lucide-react";

const ALL_TOOLS: ToolId[] = [
  "gmail_read", "gmail_send", "gmail_draft",
  "outlook_read", "outlook_send",
  "google_calendar_read", "google_calendar_write", "google_calendar_find_slot",
  "web_search", "web_scrape", "web_research",
  "supabase_read", "supabase_write", "json_transform",
  "human_approval_request", "pipeline_notify", "schedule_trigger",
];

const FAILURE_POLICIES: { value: OnFailurePolicy; label: string }[] = [
  { value: "retry_3x_then_notify", label: "Retry 3 times, then notify" },
  { value: "skip_and_continue", label: "Skip and continue pipeline" },
  { value: "halt_pipeline", label: "Stop the pipeline" },
  { value: "escalate_to_human", label: "Escalate to human" },
];

interface AgentCardProps {
  agent: AgentSpec;
  onUpdate: (updatedAgent: AgentSpec) => void;
  onClose: () => void;
}

export default function AgentCard({ agent, onUpdate, onClose }: AgentCardProps) {
  const [draft, setDraft] = useState<AgentSpec>({ ...agent, tools: [...agent.tools], guardrails: { ...agent.guardrails } });
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function updateField<K extends keyof AgentSpec>(key: K, value: AgentSpec[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    onUpdate(draft);
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }

  const availableTools = useMemo(
    () => ALL_TOOLS.filter((t) => !draft.tools.includes(t)),
    [draft.tools]
  );

  return (
    <div className="flex h-full w-105 flex-col border-l border-white/6 bg-zinc-900/95 backdrop-blur-sm overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
        <div className="flex-1 mr-3">
          <input
            type="text"
            value={draft.role}
            onChange={(e) => updateField("role", e.target.value)}
            className="w-full bg-transparent text-base font-medium text-white outline-none border-b border-transparent focus:border-zinc-600 transition-colors"
          />
          <Badge variant="info" className="mt-1.5">{draft.archetype}</Badge>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 px-5 py-5">
        {/* System Prompt */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <FileText className="size-3" />
            Agent Instructions
          </label>
          <textarea
            value={draft.system_prompt}
            onChange={(e) => updateField("system_prompt", e.target.value)}
            rows={6}
            className="w-full resize-y rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
          />
          <span className="mt-1 block text-xs text-zinc-600">
            {draft.system_prompt.length} characters
          </span>
        </div>

        {/* Tools */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <Wrench className="size-3" />
            Assigned Tools
          </label>
          <div className="flex flex-wrap gap-1.5">
            {draft.tools.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1 rounded-lg ring-1 ring-white/8 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              >
                {tool}
                <button
                  onClick={() =>
                    updateField(
                      "tools",
                      draft.tools.filter((t) => t !== tool)
                    )
                  }
                  className="ml-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
          {availableTools.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  updateField("tools", [...draft.tools, e.target.value as ToolId]);
                }
              }}
              className="mt-2 w-full rounded-xl ring-1 ring-white/8 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none border-0"
            >
              <option value="">Add tool...</option>
              {availableTools.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Approval Gate */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <ShieldCheck className="size-3" />
            Requires Human Approval
          </label>
          <button
            onClick={() => {
              updateField("requires_approval", !draft.requires_approval);
              if (draft.requires_approval) {
                updateField("approval_message", null);
              }
            }}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              draft.requires_approval ? "bg-emerald-600" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                draft.requires_approval ? "translate-x-5" : ""
              }`}
            />
          </button>
          {draft.requires_approval && (
            <input
              type="text"
              value={draft.approval_message ?? ""}
              onChange={(e) =>
                updateField("approval_message", e.target.value || null)
              }
              placeholder="Approval message..."
              className="mt-2 w-full rounded-xl ring-1 ring-white/8 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 border-0"
            />
          )}
        </div>

        {/* Failure Policy */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <AlertTriangle className="size-3" />
            On Failure
          </label>
          <select
            value={draft.on_failure}
            onChange={(e) =>
              updateField("on_failure", e.target.value as OnFailurePolicy)
            }
            className="w-full rounded-xl ring-1 ring-white/8 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none border-0"
          >
            {FAILURE_POLICIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Guardrails */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <Sliders className="size-3" />
            Guardrails
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="block text-xs text-zinc-600 mb-1">Max Tokens</span>
              <input
                type="number"
                value={draft.guardrails.max_tokens}
                onChange={(e) =>
                  updateField("guardrails", {
                    ...draft.guardrails,
                    max_tokens: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg ring-1 ring-white/8 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none border-0"
              />
            </div>
            <div>
              <span className="block text-xs text-zinc-600 mb-1">Timeout (s)</span>
              <input
                type="number"
                value={draft.guardrails.max_runtime_seconds}
                onChange={(e) =>
                  updateField("guardrails", {
                    ...draft.guardrails,
                    max_runtime_seconds: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg ring-1 ring-white/8 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none border-0"
              />
            </div>
            <div>
              <span className="block text-xs text-zinc-600 mb-1">Temp</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={draft.guardrails.temperature}
                onChange={(e) =>
                  updateField("guardrails", {
                    ...draft.guardrails,
                    temperature: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg ring-1 ring-white/8 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none border-0"
              />
            </div>
          </div>
        </div>

        {/* Model Override */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <Cpu className="size-3" />
            Model Override
          </label>
          <select
            value={draft.model ?? ""}
            onChange={(e) => updateField("model", e.target.value || null)}
            className="w-full rounded-lg ring-1 ring-white/8 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none border-0 cursor-pointer"
          >
            <option value="">Pipeline Default</option>
            <option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku</option>
            <option value="claude-sonnet-4-5-20250929">Claude 4.5 Sonnet</option>
            <option value="claude-sonnet-4-6">Claude 4.6 Sonnet</option>
            <option value="claude-opus-4-6">Claude 4.6 Opus</option>
          </select>
        </div>

        {/* Inputs */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <ArrowDownToLine className="size-3" />
            Inputs
          </label>
          <div className="space-y-1">
            {Object.entries(draft.inputs).map(([key, type]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono text-zinc-300">{key}</span>
                <span className="text-zinc-600">:</span>
                <span>{type}</span>
              </div>
            ))}
            {Object.keys(draft.inputs).length === 0 && (
              <span className="text-xs text-zinc-600">No inputs defined</span>
            )}
          </div>
        </div>

        {/* Outputs */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <ArrowUpFromLine className="size-3" />
            Outputs
          </label>
          <div className="space-y-1">
            {Object.entries(draft.outputs).map(([key, type]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono text-zinc-300">{key}</span>
                <span className="text-zinc-600">:</span>
                <span>{type}</span>
              </div>
            ))}
            {Object.keys(draft.outputs).length === 0 && (
              <span className="text-xs text-zinc-600">No outputs defined</span>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="border-t border-white/6 px-5 py-4">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
        >
          {saved ? (
            <>
              <Check className="size-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
