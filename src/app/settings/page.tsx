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
  Users,
  Plus,
  Trash2,
  Shield,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

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

// ── Team Management ──────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  email: string;
  role: "admin" | "member";
  created_at: string;
}

function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
        setIsAdmin(true);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setMessage(null);

    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, password: invitePassword, role: inviteRole }),
    });

    const data = await res.json();
    if (res.ok) {
      setMembers((prev) => [...prev, { ...data, created_at: new Date().toISOString() }]);
      setInviteEmail("");
      setInvitePassword("");
      setInviteRole("member");
      setMessage({ type: "success", text: `Invited ${data.email}` });
    } else {
      setMessage({ type: "error", text: data.error });
    }
    setInviting(false);
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from the team?`)) return;

    const res = await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      setMessage({ type: "success", text: `Removed ${email}` });
    } else {
      const data = await res.json();
      setMessage({ type: "error", text: data.error });
    }
  }

  if (loading) return <SkeletonCard className="h-32" />;
  if (!isAdmin) return null;

  return (
    <div className="mt-10">
      <PageHeader
        icon={<Users className="size-4" />}
        title="Team Members"
        description="Manage who has access to Agent Foundry."
      />

      <Card className="divide-y divide-white/6">
        {/* Member list */}
        <div className="px-5 py-4 space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-white/10 text-xs font-semibold text-zinc-300">
                  {m.email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-white">{m.email}</p>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    {m.role === "admin" ? (
                      <Shield className="size-3 text-amber-400" />
                    ) : (
                      <User className="size-3" />
                    )}
                    {m.role}
                    {m.id === currentUserId && (
                      <span className="text-zinc-600">(you)</span>
                    )}
                  </div>
                </div>
              </div>
              {m.id !== currentUserId && (
                <button
                  onClick={() => handleRemove(m.id, m.email)}
                  className="rounded-lg p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Invite new member
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all border-0"
            />
            <input
              type="password"
              placeholder="Temporary password"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              required
              className="rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all border-0"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
              className="rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all border-0"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {message && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ring-1 ${
              message.type === "success"
                ? "ring-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "ring-red-500/20 bg-red-500/10 text-red-400"
            }`}>
              {message.type === "success" ? (
                <CheckCircle2 className="size-3 shrink-0" />
              ) : (
                <AlertCircle className="size-3 shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={inviting}
            className="flex items-center gap-1.5 rounded-xl bg-linear-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-200 disabled:opacity-40"
          >
            {inviting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {inviting ? "Inviting..." : "Invite"}
          </button>
        </form>
      </Card>
    </div>
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

        <TeamManagement />
      </div>
    </div>
  );
}
