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
  Dices,
  Plug,
  Globe,
  Wrench,
  X,
  FileCode,
  TestTube,
  Pencil,
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

function generatePassword(length = 16): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
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
            <div className="relative">
              <input
                type="text"
                placeholder="Temporary password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                required
                className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 pr-9 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all border-0 font-mono"
              />
              <button
                type="button"
                onClick={() => setInvitePassword(generatePassword())}
                title="Generate random password"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
              >
                <Dices className="size-4" />
              </button>
            </div>
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

// ── Custom Integrations ──────────────────────────────────────────────────────

interface CustomIntegrationData {
  id: string;
  name: string;
  base_url: string;
  description: string | null;
  auth_type: string;
  auth_config: Record<string, unknown>;
  headers: Record<string, string>;
  body_wrapper?: string | null;
  is_active: boolean;
  created_at: string;
  custom_tools: CustomToolData[];
}

interface CustomToolData {
  id: string;
  integration_id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  parameters: { path: ToolParam[]; query: ToolParam[]; body: ToolParam[] };
  response_mapping: Record<string, string>;
}

interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface ParamRow {
  name: string;
  type: "string" | "number" | "boolean" | "object";
  description: string;
  required: boolean;
}

const emptyParam = (): ParamRow => ({
  name: "",
  type: "string",
  description: "",
  required: false,
});

function ParameterBuilder({
  label,
  params,
  onChange,
}: {
  label: string;
  params: ParamRow[];
  onChange: (params: ParamRow[]) => void;
}) {
  const addParam = () => onChange([...params, emptyParam()]);

  const updateParam = (index: number, field: keyof ParamRow, value: string | boolean) => {
    const updated = [...params];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeParam = (index: number) => onChange(params.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
          {label}
        </label>
        <button
          type="button"
          onClick={addParam}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
        >
          + Add
        </button>
      </div>

      {params.length === 0 && (
        <div
          onClick={addParam}
          className="border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg p-3 text-center text-xs text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors"
        >
          No parameters yet — click to add one
        </div>
      )}

      {params.map((param, index) => (
        <div key={index} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <input
              value={param.name}
              onChange={(e) => updateParam(index, "name", e.target.value)}
              placeholder="param_name"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <select
              value={param.type}
              onChange={(e) => updateParam(index, "type", e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="object">object</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={param.required}
                onChange={(e) => updateParam(index, "required", e.target.checked)}
                className="accent-emerald-500"
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => removeParam(index)}
              className="text-zinc-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
            >
              ×
            </button>
          </div>
          <input
            value={param.description}
            onChange={(e) => updateParam(index, "description", e.target.value)}
            placeholder="Description of this parameter"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      ))}
    </div>
  );
}

const AUTH_TYPE_OPTIONS = [
  { value: "none", label: "No Auth" },
  { value: "api_key", label: "API Key" },
  { value: "bearer_token", label: "Bearer Token" },
  { value: "basic_auth", label: "Basic Auth" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "custom_header", label: "Custom Header" },
];

const METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function CustomIntegrations() {
  const [integrations, setIntegrations] = useState<CustomIntegrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New integration form state
  const [newName, setNewName] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAuthType, setNewAuthType] = useState("none");
  const [newAuthConfig, setNewAuthConfig] = useState<Record<string, string>>({});
  const [newBodyWrapper, setNewBodyWrapper] = useState("");
  const [creating, setCreating] = useState(false);

  // New tool form state
  const [showToolForm, setShowToolForm] = useState<string | null>(null);
  const [toolName, setToolName] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [toolMethod, setToolMethod] = useState("GET");
  const [toolPath, setToolPath] = useState("");
  const [toolBodyParams, setToolBodyParams] = useState<ParamRow[]>([]);
  const [toolQueryParams, setToolQueryParams] = useState<ParamRow[]>([]);
  const [toolPathParams, setToolPathParams] = useState<ParamRow[]>([]);
  const [addingTool, setAddingTool] = useState(false);

  // Edit tool state
  const [editingTool, setEditingTool] = useState<(CustomToolData & {
    bodyParams: ParamRow[];
    queryParams: ParamRow[];
    pathParams: ParamRow[];
  }) | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // OpenAPI import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSpec, setImportSpec] = useState("");
  const [importing, setImporting] = useState(false);

  // Test tool
  const [testingToolId, setTestingToolId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; result: string } | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    try {
      const res = await fetch("/api/custom-integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations ?? []);
      }
    } catch {
      console.error("Failed to fetch custom integrations");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const authConfig = buildAuthConfigFromForm(newAuthType, newAuthConfig);
      const res = await fetch("/api/custom-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          base_url: newBaseUrl.replace(/\/$/, ""),
          description: newDescription || null,
          auth_type: newAuthType,
          auth_config: authConfig,
          body_wrapper: newBodyWrapper || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIntegrations((prev) => [{ ...data.integration, custom_tools: [] }, ...prev]);
      setShowNewForm(false);
      setNewName("");
      setNewBaseUrl("");
      setNewDescription("");
      setNewAuthType("none");
      setNewAuthConfig({});
      setNewBodyWrapper("");
      setMessage({ type: "success", text: `Created "${data.integration.name}"` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to create" });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its tools?`)) return;

    const res = await fetch(`/api/custom-integrations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      setMessage({ type: "success", text: `Deleted "${name}"` });
    } else {
      const data = await res.json();
      setMessage({ type: "error", text: data.error });
    }
  }

  function toToolParams(rows: ParamRow[]): ToolParam[] {
    return rows.filter((r) => r.name.trim()).map((r) => ({
      name: r.name.trim(),
      type: r.type,
      description: r.description,
      required: r.required,
    }));
  }

  async function handleAddTool(integrationId: string) {
    setAddingTool(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/custom-integrations/${integrationId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: toolName,
          description: toolDescription,
          method: toolMethod,
          path: toolPath,
          parameters: {
            path: toToolParams(toolPathParams),
            query: toToolParams(toolQueryParams),
            body: toToolParams(toolBodyParams),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integrationId
            ? { ...i, custom_tools: [...i.custom_tools, data.tool] }
            : i
        )
      );
      setShowToolForm(null);
      setToolName("");
      setToolDescription("");
      setToolMethod("GET");
      setToolPath("");
      setToolBodyParams([]);
      setToolQueryParams([]);
      setToolPathParams([]);
      setMessage({ type: "success", text: `Added tool "custom_${data.tool.name}"` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to add tool" });
    } finally {
      setAddingTool(false);
    }
  }

  function handleEditTool(tool: CustomToolData, integrationId: string) {
    const toParamRows = (params: ToolParam[]): ParamRow[] =>
      params.map((p) => ({
        name: p.name,
        type: (p.type as ParamRow["type"]) || "string",
        description: p.description,
        required: p.required,
      }));

    setEditingTool({
      ...tool,
      integration_id: integrationId,
      bodyParams: toParamRows(tool.parameters.body ?? []),
      queryParams: toParamRows(tool.parameters.query ?? []),
      pathParams: toParamRows(tool.parameters.path ?? []),
    });
    setShowToolForm(null);
  }

  async function handleSaveEditedTool() {
    if (!editingTool) return;
    setSavingEdit(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/custom-integrations/${editingTool.integration_id}/tools/${editingTool.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingTool.name,
            description: editingTool.description,
            method: editingTool.method,
            path: editingTool.path,
            parameters: {
              path: toToolParams(editingTool.pathParams),
              query: toToolParams(editingTool.queryParams),
              body: toToolParams(editingTool.bodyParams),
            },
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === editingTool.integration_id
            ? {
                ...i,
                custom_tools: i.custom_tools.map((t) =>
                  t.id === editingTool.id
                    ? {
                        ...t,
                        name: editingTool.name,
                        description: editingTool.description,
                        method: editingTool.method,
                        path: editingTool.path,
                        parameters: {
                          path: toToolParams(editingTool.pathParams),
                          query: toToolParams(editingTool.queryParams),
                          body: toToolParams(editingTool.bodyParams),
                        },
                      }
                    : t
                ),
              }
            : i
        )
      );
      setEditingTool(null);
      setMessage({ type: "success", text: `Updated tool "custom_${editingTool.name}"` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update tool" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteTool(integrationId: string, toolId: string, toolName: string) {
    const res = await fetch(`/api/custom-integrations/${integrationId}/tools/${toolId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integrationId
            ? { ...i, custom_tools: i.custom_tools.filter((t) => t.id !== toolId) }
            : i
        )
      );
      setMessage({ type: "success", text: `Removed "custom_${toolName}"` });
    }
  }

  async function handleTestTool(toolId: string) {
    setTestingToolId(toolId);
    setTestResult(null);

    try {
      const res = await fetch("/api/custom-integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_id: toolId, input: {} }),
      });

      const data = await res.json();
      setTestResult({ success: data.success, result: data.result ?? data.error });
    } catch (err) {
      setTestResult({ success: false, result: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTestingToolId(null);
    }
  }

  async function handleImport() {
    setImporting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/custom-integrations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openapi_spec: importSpec }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const parsed = data.parsed;

      // Create the integration
      const createRes = await fetch("/api/custom-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.name,
          base_url: parsed.base_url,
          description: parsed.description,
          auth_type: parsed.auth_type ?? "none",
          auth_config: parsed.auth_config ?? { type: "none" },
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error);

      const integrationId = createData.integration.id;

      // Add all tools
      const tools: CustomToolData[] = [];
      for (const tool of parsed.tools ?? []) {
        const toolRes = await fetch(`/api/custom-integrations/${integrationId}/tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tool),
        });
        if (toolRes.ok) {
          const toolData = await toolRes.json();
          tools.push(toolData.tool);
        }
      }

      setIntegrations((prev) => [
        { ...createData.integration, custom_tools: tools },
        ...prev,
      ]);
      setShowImportModal(false);
      setImportSpec("");
      setMessage({
        type: "success",
        text: `Imported "${parsed.name}" with ${tools.length} tools`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  function buildAuthConfigFromForm(
    authType: string,
    fields: Record<string, string>
  ): Record<string, unknown> {
    switch (authType) {
      case "api_key":
        return {
          type: "api_key",
          key_name: fields.key_name ?? "X-API-Key",
          key_value: fields.key_value ?? "",
          in: fields.in ?? "header",
        };
      case "bearer_token":
        return { type: "bearer_token", token: fields.token ?? "" };
      case "basic_auth":
        return {
          type: "basic_auth",
          username: fields.username ?? "",
          password: fields.password ?? "",
        };
      case "oauth2":
        return {
          type: "oauth2",
          client_id: fields.client_id ?? "",
          client_secret: fields.client_secret ?? "",
          token_url: fields.token_url ?? "",
          access_token: fields.access_token ?? "",
          refresh_token: fields.refresh_token ?? "",
        };
      case "custom_header":
        return {
          type: "custom_header",
          header_name: fields.header_name ?? "Authorization",
          header_value: fields.header_value ?? "",
        };
      default:
        return { type: "none" };
    }
  }

  function renderAuthFields() {
    switch (newAuthType) {
      case "api_key":
        return (
          <>
            <input
              type="text"
              placeholder="Header name (e.g. X-API-Key)"
              value={newAuthConfig.key_name ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, key_name: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="password"
              placeholder="API Key value"
              value={newAuthConfig.key_value ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, key_value: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <select
              value={newAuthConfig.in ?? "header"}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, in: e.target.value }))}
              className="rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            >
              <option value="header">In Header</option>
              <option value="query">In Query String</option>
            </select>
          </>
        );
      case "bearer_token":
        return (
          <input
            type="password"
            placeholder="Bearer token"
            value={newAuthConfig.token ?? ""}
            onChange={(e) => setNewAuthConfig((p) => ({ ...p, token: e.target.value }))}
            className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
          />
        );
      case "basic_auth":
        return (
          <>
            <input
              type="text"
              placeholder="Username"
              value={newAuthConfig.username ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, username: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="password"
              placeholder="Password"
              value={newAuthConfig.password ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, password: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
          </>
        );
      case "oauth2":
        return (
          <>
            <input
              type="text"
              placeholder="Client ID"
              value={newAuthConfig.client_id ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, client_id: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="password"
              placeholder="Client Secret"
              value={newAuthConfig.client_secret ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, client_secret: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="text"
              placeholder="Token URL"
              value={newAuthConfig.token_url ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, token_url: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="password"
              placeholder="Access Token (if available)"
              value={newAuthConfig.access_token ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, access_token: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="password"
              placeholder="Refresh Token (optional)"
              value={newAuthConfig.refresh_token ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, refresh_token: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
          </>
        );
      case "custom_header":
        return (
          <>
            <input
              type="text"
              placeholder="Header name (e.g. Authorization)"
              value={newAuthConfig.header_name ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, header_name: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="password"
              placeholder="Header value (e.g. token api_key:api_secret)"
              value={newAuthConfig.header_value ?? ""}
              onChange={(e) => setNewAuthConfig((p) => ({ ...p, header_value: e.target.value }))}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <p className="text-xs text-zinc-600">
              For ERPNext: token your_api_key:your_api_secret
            </p>
          </>
        );
      default:
        return null;
    }
  }

  if (loading) return <SkeletonCard className="h-32" />;

  return (
    <div className="mt-10">
      <PageHeader
        icon={<Plug className="size-4" />}
        title="Custom Integrations"
        description="Connect any API to Agent Foundry. Custom tools become available to all pipelines."
      />

      {message && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs ring-1 ${
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

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-1.5 rounded-xl bg-linear-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all duration-200"
        >
          <Plus className="size-3.5" />
          New Integration
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 rounded-xl ring-1 ring-white/10 hover:ring-white/20 bg-zinc-800/80 hover:bg-zinc-700/80 px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-200"
        >
          <FileCode className="size-3.5" />
          Import OpenAPI
        </button>
      </div>

      {/* New integration form */}
      {showNewForm && (
        <Card className="mb-4">
          <form onSubmit={handleCreate} className="px-5 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              New API Integration
            </p>
            <input
              type="text"
              placeholder="Integration name (e.g. Stripe, Jira)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="url"
              placeholder="Base URL (e.g. https://api.stripe.com)"
              value={newBaseUrl}
              onChange={(e) => setNewBaseUrl(e.target.value)}
              required
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
            />
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">
                Body Wrapper <span className="text-zinc-600 ml-1">(optional)</span>
              </label>
              <input
                type="text"
                value={newBodyWrapper}
                onChange={(e) => setNewBodyWrapper(e.target.value)}
                placeholder='e.g. data (for Frappe/ERPNext)'
                className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
              />
              <p className="text-xs text-zinc-600">
                If set, wraps POST/PUT/PATCH body as {`{ "${newBodyWrapper || "wrapper"}": { ...params } }`}. Frappe/ERPNext APIs require &quot;data&quot;.
              </p>
            </div>
            <div>
              <label className="mb-1 text-xs font-medium text-zinc-400">Auth Type</label>
              <select
                value={newAuthType}
                onChange={(e) => {
                  setNewAuthType(e.target.value);
                  setNewAuthConfig({});
                }}
                className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
              >
                {AUTH_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {renderAuthFields()}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-1.5 rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-40"
              >
                {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-xl ring-1 ring-white/10 bg-zinc-800/80 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Integration list */}
      <div className="space-y-3">
        {integrations.length === 0 && !showNewForm && (
          <Card className="px-5 py-8 text-center">
            <Globe className="size-8 mx-auto text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400">No custom integrations yet.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Add an API integration or import an OpenAPI spec to get started.
            </p>
          </Card>
        )}

        {integrations.map((integration) => (
          <Card key={integration.id}>
            <button
              onClick={() => setExpandedId(expandedId === integration.id ? null : integration.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg ring-1 bg-cyan-500/10 ring-cyan-500/20">
                  <Globe className="size-4 text-cyan-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-white">{integration.name}</span>
                  <p className="text-xs text-zinc-500">
                    {integration.base_url} — {integration.custom_tools.length} tool{integration.custom_tools.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs">
                  {integration.is_active ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Active</span>
                    </>
                  ) : (
                    <>
                      <Circle className="size-3.5 text-zinc-600" />
                      <span className="text-zinc-500">Inactive</span>
                    </>
                  )}
                </span>
                {expandedId === integration.id ? (
                  <ChevronUp className="size-4 text-zinc-600" />
                ) : (
                  <ChevronDown className="size-4 text-zinc-600" />
                )}
              </div>
            </button>

            {expandedId === integration.id && (
              <div className="border-t border-white/6 px-5 py-4 space-y-4">
                {/* Body Wrapper */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Body Wrapper <span className="normal-case font-normal text-zinc-600">(optional)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={integration.body_wrapper ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIntegrations((prev) =>
                          prev.map((i) =>
                            i.id === integration.id ? { ...i, body_wrapper: val || null } : i
                          )
                        );
                      }}
                      placeholder='e.g. data (for Frappe/ERPNext)'
                      className="flex-1 rounded-lg bg-zinc-800/80 px-3 py-1.5 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
                    />
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/custom-integrations/${integration.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ body_wrapper: integration.body_wrapper || null }),
                          });
                          if (res.ok) {
                            setMessage({ type: "success", text: "Body wrapper updated" });
                          } else {
                            const d = await res.json();
                            setMessage({ type: "error", text: d.error });
                          }
                        } catch {
                          setMessage({ type: "error", text: "Failed to update body wrapper" });
                        }
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600">
                    Wraps POST/PUT/PATCH body as {`{ "${integration.body_wrapper || "wrapper"}": { ...params } }`}. Frappe/ERPNext requires &quot;data&quot;.
                  </p>
                </div>

                {/* Tools list */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Tools
                  </p>
                  {integration.custom_tools.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No tools defined yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {integration.custom_tools.map((tool) => (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between rounded-lg ring-1 ring-white/6 bg-zinc-800/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Wrench className="size-3.5 text-zinc-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-mono text-cyan-300 truncate">
                                custom_{tool.name}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">
                                {tool.method} {tool.path} — {tool.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              onClick={() => handleEditTool(tool, integration.id)}
                              className="rounded-lg p-1.5 text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              title="Edit tool"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleTestTool(tool.id)}
                              disabled={testingToolId === tool.id}
                              className="rounded-lg p-1.5 text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                              title="Test tool"
                            >
                              {testingToolId === tool.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <TestTube className="size-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteTool(integration.id, tool.id, tool.name)}
                              className="rounded-lg p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete tool"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {testResult && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-xs ring-1 font-mono ${
                      testResult.success
                        ? "ring-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "ring-red-500/20 bg-red-500/10 text-red-300"
                    }`}>
                      {testResult.result.substring(0, 500)}
                    </div>
                  )}
                </div>

                {/* Edit tool form */}
                {editingTool && editingTool.integration_id === integration.id && (
                  <div className="space-y-3 rounded-lg ring-1 ring-emerald-500/30 bg-zinc-800/30 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white">Edit Tool</p>
                      <button
                        onClick={() => setEditingTool(null)}
                        className="text-zinc-500 hover:text-white transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Tool name (snake_case)"
                      value={editingTool.name}
                      onChange={(e) => setEditingTool((p) => p ? { ...p, name: e.target.value } : p)}
                      className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={editingTool.description}
                      onChange={(e) => setEditingTool((p) => p ? { ...p, description: e.target.value } : p)}
                      className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editingTool.method}
                        onChange={(e) => setEditingTool((p) => p ? { ...p, method: e.target.value } : p)}
                        className="rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
                      >
                        {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input
                        type="text"
                        placeholder="/path/{id}"
                        value={editingTool.path}
                        onChange={(e) => setEditingTool((p) => p ? { ...p, path: e.target.value } : p)}
                        className="flex-1 rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0 font-mono"
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-400 font-medium">Parameters</p>
                      <ParameterBuilder
                        label="Body Parameters (POST / PUT / PATCH)"
                        params={editingTool.bodyParams}
                        onChange={(params) => setEditingTool((p) => p ? { ...p, bodyParams: params } : p)}
                      />
                      <ParameterBuilder
                        label="Query Parameters (appended to URL)"
                        params={editingTool.queryParams}
                        onChange={(params) => setEditingTool((p) => p ? { ...p, queryParams: params } : p)}
                      />
                      <ParameterBuilder
                        label="Path Parameters (e.g. /resource/{id})"
                        params={editingTool.pathParams}
                        onChange={(params) => setEditingTool((p) => p ? { ...p, pathParams: params } : p)}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveEditedTool}
                        disabled={savingEdit}
                        className="flex items-center gap-1.5 rounded-lg bg-linear-to-b from-emerald-500 to-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        {savingEdit ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingTool(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Add tool form */}
                {showToolForm === integration.id ? (
                  <div className="space-y-3 rounded-lg ring-1 ring-white/6 bg-zinc-800/30 p-4">
                    <p className="text-xs font-semibold text-zinc-400">New Tool</p>
                    <input
                      type="text"
                      placeholder="Tool name (snake_case)"
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Description (what this endpoint does)"
                      value={toolDescription}
                      onChange={(e) => setToolDescription(e.target.value)}
                      className="w-full rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
                    />
                    <div className="flex gap-2">
                      <select
                        value={toolMethod}
                        onChange={(e) => setToolMethod(e.target.value)}
                        className="rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0"
                      >
                        {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input
                        type="text"
                        placeholder="/path/{id}"
                        value={toolPath}
                        onChange={(e) => setToolPath(e.target.value)}
                        className="flex-1 rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-white ring-1 ring-white/8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0 font-mono"
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-400 font-medium">Parameters</p>
                      <ParameterBuilder
                        label="Body Parameters (POST / PUT / PATCH)"
                        params={toolBodyParams}
                        onChange={setToolBodyParams}
                      />
                      <ParameterBuilder
                        label="Query Parameters (appended to URL)"
                        params={toolQueryParams}
                        onChange={setToolQueryParams}
                      />
                      <ParameterBuilder
                        label="Path Parameters (e.g. /resource/{id})"
                        params={toolPathParams}
                        onChange={setToolPathParams}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleAddTool(integration.id)}
                        disabled={addingTool || !toolName || !toolPath}
                        className="flex items-center gap-1.5 rounded-lg bg-linear-to-b from-emerald-500 to-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        {addingTool ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                        Add Tool
                      </button>
                      <button
                        onClick={() => setShowToolForm(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowToolForm(integration.id); setEditingTool(null); }}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-cyan-400 transition-colors"
                  >
                    <Plus className="size-3" />
                    Add tool
                  </button>
                )}

                {/* Delete integration */}
                <div className="pt-2 border-t border-white/6">
                  <button
                    onClick={() => handleDelete(integration.id, integration.name)}
                    className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="size-3" />
                    Delete integration
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* OpenAPI Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl ring-1 ring-white/10 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
              <div className="flex items-center gap-2">
                <FileCode className="size-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">Import OpenAPI Spec</span>
              </div>
              <button
                onClick={() => { setShowImportModal(false); setImportSpec(""); }}
                className="rounded-lg p-1 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-zinc-400">
                Paste an OpenAPI (Swagger) spec in JSON or YAML format. Claude will parse it and create the integration with tools.
              </p>
              <textarea
                value={importSpec}
                onChange={(e) => setImportSpec(e.target.value)}
                placeholder="Paste OpenAPI spec here..."
                rows={12}
                className="w-full rounded-xl ring-1 ring-white/8 bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-300 font-mono outline-none focus:ring-2 focus:ring-cyan-500/50 border-0 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowImportModal(false); setImportSpec(""); }}
                  className="rounded-xl ring-1 ring-white/10 bg-zinc-800/80 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !importSpec.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-linear-to-b from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 disabled:opacity-40"
                >
                  {importing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileCode className="size-3.5" />
                      Import
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

        <CustomIntegrations />
        <TeamManagement />
      </div>
    </div>
  );
}
