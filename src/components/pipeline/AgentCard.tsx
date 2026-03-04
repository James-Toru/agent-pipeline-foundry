"use client";

import { useState } from "react";
import type {
  AgentSpec,
  ToolId,
  OnFailurePolicy,
} from "@/types/pipeline";

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

  function updateField<K extends keyof AgentSpec>(key: K, value: AgentSpec[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    onUpdate(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const availableTools = ALL_TOOLS.filter((t) => !draft.tools.includes(t));

  return (
    <div className="flex h-full w-[420px] flex-col border-l border-zinc-800 bg-zinc-900 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div className="flex-1 mr-3">
          <input
            type="text"
            value={draft.role}
            onChange={(e) => updateField("role", e.target.value)}
            className="w-full bg-transparent text-base font-medium text-white outline-none focus:border-b focus:border-zinc-600"
          />
          <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
            {draft.archetype}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 space-y-6 px-5 py-5">
        {/* System Prompt */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Agent Instructions
          </label>
          <textarea
            value={draft.system_prompt}
            onChange={(e) => updateField("system_prompt", e.target.value)}
            rows={6}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
          />
          <span className="mt-1 block text-xs text-zinc-600">
            {draft.system_prompt.length} characters
          </span>
        </div>

        {/* Tools */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Assigned Tools
          </label>
          <div className="flex flex-wrap gap-1.5">
            {draft.tools.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              >
                {tool}
                <button
                  onClick={() =>
                    updateField(
                      "tools",
                      draft.tools.filter((t) => t !== tool)
                    )
                  }
                  className="ml-0.5 text-zinc-600 hover:text-red-400"
                >
                  &times;
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
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none"
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
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
            />
          )}
        </div>

        {/* Failure Policy */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            On Failure
          </label>
          <select
            value={draft.on_failure}
            onChange={(e) =>
              updateField("on_failure", e.target.value as OnFailurePolicy)
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none"
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
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none"
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
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none"
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
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
      <div className="border-t border-zinc-800 px-5 py-4">
        <button
          onClick={handleSave}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          {saved ? "Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
