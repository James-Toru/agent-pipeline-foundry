"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  agent_count: number;
  triggers: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Sales: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Research: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Productivity: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Marketing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cloningIndex, setCloningIndex] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/templates");
        if (!res.ok) return;
        const data = await res.json();
        setTemplates(data.templates);
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  async function handleClone(index: number) {
    setCloningIndex(index);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_index: index }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clone template");
      }
      const data = await res.json();
      router.push(`/pipelines/${data.pipeline.id}`);
    } catch (err) {
      console.error("Clone failed:", err);
      setCloningIndex(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  // Group templates by category
  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold text-white">Pipeline Templates</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pre-built pipeline blueprints. Clone one to get started instantly.
        </p>

        {categories.map((category) => (
          <div key={category} className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {category}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {templates
                .filter((t) => t.category === category)
                .map((template) => {
                  const templateIndex = templates.indexOf(template);
                  const catStyle =
                    CATEGORY_COLORS[category] ??
                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

                  return (
                    <div
                      key={template.id}
                      className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-zinc-300">
                          {template.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-white">
                            {template.name}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                            {template.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${catStyle}`}
                        >
                          {category}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {template.agent_count} agents
                        </span>
                        {template.triggers.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500"
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => handleClone(templateIndex)}
                        disabled={cloningIndex !== null}
                        className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40"
                      >
                        {cloningIndex === templateIndex
                          ? "Cloning..."
                          : "Use Template"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <p className="mt-12 text-center text-zinc-600">
            No templates available.
          </p>
        )}
      </div>
    </div>
  );
}
