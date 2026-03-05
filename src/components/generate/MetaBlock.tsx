"use client";

import type { PipelineMeta } from "@/types/pipeline";
import { Plus, Lightbulb, ArrowRight } from "lucide-react";

interface MetaBlockProps {
  meta: PipelineMeta;
}

export default function MetaBlock({ meta }: MetaBlockProps) {
  const hasGaps = meta.gaps_filled.length > 0;
  const hasAssumptions = meta.assumptions.length > 0;
  const hasEnhancements = meta.recommended_enhancements.length > 0;

  if (!hasGaps && !hasAssumptions && !hasEnhancements) {
    return null;
  }

  return (
    <div className="space-y-6">
      {hasGaps && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 mb-3">
            What Agent Foundry Added
          </h3>
          <ul className="space-y-2">
            {meta.gaps_filled.map((gap, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl ring-1 ring-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-zinc-300"
              >
                <Plus className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasAssumptions && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-3">
            Decisions Made
          </h3>
          <ul className="space-y-2">
            {meta.assumptions.map((assumption, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl ring-1 ring-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-zinc-300"
              >
                <Lightbulb className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                <span>{assumption}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasEnhancements && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-400 mb-3">
            Recommended Next Steps
          </h3>
          <ul className="space-y-2">
            {meta.recommended_enhancements.map((enhancement, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl ring-1 ring-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-zinc-300"
              >
                <ArrowRight className="size-3.5 text-sky-400 mt-0.5 shrink-0" />
                <span>{enhancement}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
