"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import {
  LayoutTemplate,
  TrendingUp,
  Search,
  Zap,
  Megaphone,
  Bot,
  Plus,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  agent_count: number;
  triggers: string[];
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Sales: TrendingUp,
  Research: Search,
  Productivity: Zap,
  Marketing: Megaphone,
};

type BadgeVariant = "info" | "success" | "warning" | "default";

const CATEGORY_BADGE: Record<string, BadgeVariant> = {
  Sales: "info",
  Research: "default",
  Productivity: "success",
  Marketing: "warning",
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);

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

  async function handleClone(templateId: string) {
    const index = templates.findIndex((t) => t.id === templateId);
    if (index === -1) return;
    setCloningId(templateId);
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
      setCloningId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-4xl">
          <div className="h-8 w-48 rounded-lg skeleton-shimmer mb-8" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          icon={<LayoutTemplate className="size-4" />}
          title="Pipeline Templates"
          description="Pre-built blueprints. Clone one to get started instantly."
        />

        {categories.map((category) => {
          const CategoryIcon = CATEGORY_ICONS[category];
          return (
            <div key={category} className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                {CategoryIcon && <CategoryIcon className="size-4 text-zinc-500" />}
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  {category}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {templates
                  .filter((t) => t.category === category)
                  .map((template) => {
                    const badgeVariant = CATEGORY_BADGE[category] ?? "default";
                    const IconComponent = CATEGORY_ICONS[category];

                    return (
                      <Card key={template.id} hover className="flex flex-col p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-white/6 text-zinc-400">
                            {IconComponent ? (
                              <IconComponent className="size-5" />
                            ) : (
                              <span className="text-sm font-bold">{template.icon}</span>
                            )}
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
                          <Badge variant={badgeVariant}>{category}</Badge>
                          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                            <Bot className="size-3" />
                            {template.agent_count} agents
                          </span>
                          {template.triggers.map((t) => (
                            <Badge key={t} variant="default">{t}</Badge>
                          ))}
                        </div>

                        <button
                          onClick={() => handleClone(template.id)}
                          disabled={cloningId !== null}
                          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {cloningId === template.id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Cloning...
                            </>
                          ) : (
                            <>
                              <Plus className="size-3.5" />
                              Use Template
                            </>
                          )}
                        </button>
                      </Card>
                    );
                  })}
              </div>
            </div>
          );
        })}

        {templates.length === 0 && (
          <EmptyState
            icon={<LayoutTemplate className="size-6" />}
            title="No templates"
            description="Templates are not available right now."
          />
        )}
      </div>
    </div>
  );
}
