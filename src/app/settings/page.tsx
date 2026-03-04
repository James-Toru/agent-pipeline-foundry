"use client";

import { useEffect, useState } from "react";

interface IntegrationStatus {
  gmail: { configured: boolean };
  google_calendar: { configured: boolean };
  brave_search: { configured: boolean };
}

interface IntegrationConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  fields: { key: string; label: string; type: "text" | "password" }[];
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "M",
    description: "Read, send, and draft emails via Gmail.",
    fields: [
      { key: "GMAIL_CLIENT_ID", label: "Client ID", type: "text" },
      { key: "GMAIL_CLIENT_SECRET", label: "Client Secret", type: "password" },
      { key: "GMAIL_REFRESH_TOKEN", label: "Refresh Token", type: "password" },
    ],
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    icon: "C",
    description: "Read, create, and find available slots on Google Calendar.",
    fields: [
      { key: "GOOGLE_CLIENT_ID", label: "Client ID", type: "text" },
      {
        key: "GOOGLE_CLIENT_SECRET",
        label: "Client Secret",
        type: "password",
      },
      {
        key: "GOOGLE_REFRESH_TOKEN",
        label: "Refresh Token",
        type: "password",
      },
    ],
  },
  {
    id: "brave_search",
    name: "Brave Search",
    icon: "S",
    description: "Web search, scraping, and multi-step research.",
    fields: [
      { key: "BRAVE_API_KEY", label: "API Key", type: "password" },
    ],
  },
];

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
  const [message, setMessage] = useState<string | null>(null);

  function handleFieldChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration: config.id,
          credentials,
        }),
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

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-zinc-300">
            {config.icon}
          </div>
          <div>
            <span className="text-sm font-medium text-white">
              {config.name}
            </span>
            <p className="text-xs text-zinc-500">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 text-xs ${
              configured ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                configured ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            {configured ? "Connected" : "Not configured"}
          </span>
          <span className="text-zinc-600">{isOpen ? "\u25B2" : "\u25BC"}</span>
        </div>
      </button>

      {/* Expandable credentials form */}
      {isOpen && (
        <div className="border-t border-zinc-800 px-5 py-4 space-y-3">
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                {field.label}
              </label>
              <input
                type={field.type}
                value={credentials[field.key] ?? ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}...`}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
              />
            </div>
          ))}

          {message && (
            <p className="text-xs text-zinc-400">{message}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-white">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect external tools to enable real agent actions.
        </p>

        <div className="mt-8 space-y-3">
          {INTEGRATIONS.map((config) => (
            <IntegrationCard
              key={config.id}
              config={config}
              configured={
                status?.[config.id as keyof IntegrationStatus]?.configured ??
                false
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
