"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import {
  Settings2,
  Mail,
  Calendar,
  Search,
  Database,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  Circle,
  ChevronUp,
  ChevronDown,
  Lock,
  Save,
  Loader2,
  AlertCircle,
  Zap,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  gmail: { configured: boolean };
  google_calendar: { configured: boolean };
  brave_search: { configured: boolean };
  hubspot: { configured: boolean };
  slack: { configured: boolean };
  notion: { configured: boolean };
}

interface IntegrationConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  tint: string;
  iconColor: string;
  description: string;
  fields: {
    key: string;
    label: string;
    type: "text" | "password";
    optional?: boolean;
    helperText?: string;
  }[];
  note?: string;
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: Mail,
    tint: "bg-red-500/10 ring-red-500/20",
    iconColor: "text-red-400",
    description: "Read, send, and draft emails via Gmail.",
    fields: [
      { key: "GMAIL_CLIENT_ID", label: "Client ID", type: "text" },
      { key: "GMAIL_CLIENT_SECRET", label: "Client Secret", type: "password" },
      { key: "GMAIL_REFRESH_TOKEN", label: "Refresh Token", type: "password" },
    ],
  },
  {
    id: "google_calendar",
    name: "Google (Gmail, Calendar & Sheets)",
    icon: Calendar,
    tint: "bg-blue-500/10 ring-blue-500/20",
    iconColor: "text-blue-400",
    description: "Send emails, manage calendar events, and read/write Google Sheets. One OAuth credential set covers all three.",
    fields: [
      { key: "GOOGLE_CLIENT_ID", label: "Client ID", type: "text" },
      { key: "GOOGLE_CLIENT_SECRET", label: "Client Secret", type: "password" },
      { key: "GOOGLE_REFRESH_TOKEN", label: "Refresh Token", type: "password" },
    ],
  },
  {
    id: "brave_search",
    name: "Brave Search",
    icon: Search,
    tint: "bg-orange-500/10 ring-orange-500/20",
    iconColor: "text-orange-400",
    description: "Web search, scraping, and multi-step research.",
    fields: [
      { key: "BRAVE_API_KEY", label: "API Key", type: "password" },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    icon: Database,
    tint: "bg-amber-500/10 ring-amber-500/20",
    iconColor: "text-amber-400",
    description: "Contacts, companies, deals, tasks, notes, and email logging.",
    fields: [
      { key: "HUBSPOT_ACCESS_TOKEN", label: "Private App Access Token", type: "password" },
      { key: "HUBSPOT_PORTAL_ID", label: "Portal ID", type: "text", optional: true },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: MessageSquare,
    tint: "bg-purple-500/10 ring-purple-500/20",
    iconColor: "text-purple-400",
    description: "Send messages, DMs, notifications, and approval gate requests.",
    fields: [
      { key: "SLACK_BOT_TOKEN", label: "Bot Token", type: "password" },
      { key: "SLACK_SIGNING_SECRET", label: "Signing Secret", type: "password" },
      { key: "SLACK_APPROVAL_CHANNEL", label: "Approval Channel", type: "text", optional: true },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    icon: BookOpen,
    tint: "bg-indigo-500/10 ring-indigo-500/20",
    iconColor: "text-indigo-400",
    description: "Create and update pages and databases in your Notion workspace.",
    fields: [
      {
        key: "NOTION_API_KEY",
        label: "API Key",
        type: "password",
        helperText: "Get this from notion.so/my-integrations",
      },
    ],
    note: "After connecting, you must share each Notion page or database with the Agent Foundry integration. Open the page in Notion → ··· menu → Add connections → Agent Foundry",
  },
];

// ── Integration Card ──────────────────────────────────────────────────────────

function IntegrationCard({
  config,
  configured,
}: {
  config: IntegrationConfig;
  configured: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const Icon = config.icon;

  function handleFieldChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration: config.id, credentials }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to save credentials."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration: config.id }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message ?? data.error });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setIsTesting(false);
    }
  }

  const isSuccess = message?.toLowerCase().includes("updated");

  return (
    <Card>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${config.tint}`}>
            <Icon className={`size-4 ${config.iconColor}`} />
          </div>
          <div>
            <span className="text-sm font-medium text-white">
              {config.name}
            </span>
            <p className="text-xs text-zinc-500">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs">
            {configured ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400">Connected</span>
              </>
            ) : (
              <>
                <Circle className="size-3.5 text-zinc-600" />
                <span className="text-zinc-500">Not configured</span>
              </>
            )}
          </span>
          <span className="text-[10px] text-zinc-600">
            {configured ? "via Settings" : ""}
          </span>
          {isOpen ? (
            <ChevronUp className="size-4 text-zinc-600" />
          ) : (
            <ChevronDown className="size-4 text-zinc-600" />
          )}
        </div>
      </button>

      {/* Expandable credentials form */}
      {isOpen && (
        <div className="border-t border-white/6 px-5 py-4 space-y-3">
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                {field.type === "password" && <Lock className="size-3" />}
                {field.label}
                {field.optional && (
                  <span className="text-zinc-600 font-normal">(optional)</span>
                )}
              </label>
              <input
                type={field.type}
                value={credentials[field.key] ?? ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}...`}
                className="w-full rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 border-0"
              />
              {field.helperText && (
                <p className="mt-1 text-xs text-zinc-600">{field.helperText}</p>
              )}
            </div>
          ))}

          {config.note && (
            <div className="flex items-start gap-2 rounded-xl ring-1 ring-yellow-500/20 bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-300">
              <Info className="size-3.5 mt-0.5 shrink-0 text-yellow-400" />
              <span>{config.note}</span>
            </div>
          )}

          {message && (
            <div className={`flex items-start gap-2 rounded-xl ring-1 px-3 py-2 text-xs ${
              isSuccess
                ? "ring-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "ring-red-500/20 bg-red-500/10 text-red-400"
            }`}>
              {isSuccess ? (
                <CheckCircle2 className="size-3 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="size-3 mt-0.5 shrink-0" />
              )}
              {message}
            </div>
          )}

          {testResult && (
            <div className={`flex items-start gap-2 rounded-xl ring-1 px-3 py-2 text-xs ${
              testResult.success
                ? "ring-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "ring-red-500/20 bg-red-500/10 text-red-400"
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="size-3 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="size-3 mt-0.5 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isSaving || isTesting}
              className="flex items-center gap-1.5 rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-40"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save
                </>
              )}
            </button>
            <button
              onClick={handleTest}
              disabled={isTesting || isSaving}
              className="flex items-center gap-1.5 rounded-xl ring-1 ring-white/10 hover:ring-white/20 bg-zinc-800/80 hover:bg-zinc-700/80 px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-200 disabled:opacity-40"
            >
              {isTesting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Test Connection
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-2xl">
          <div className="h-8 w-48 rounded-lg skeleton-shimmer mb-8" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-20" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <PageHeader
          icon={<Settings2 className="size-4" />}
          title="Integrations"
          description="Connect external tools to enable real agent actions."
        />

        <div className="space-y-3">
          {INTEGRATIONS.map((config) => (
            <IntegrationCard
              key={config.id}
              config={config}
              configured={
                status?.[config.id as keyof IntegrationStatus]?.configured ?? false
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
