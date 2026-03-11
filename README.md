# Agent Foundry

A Pipeline Factory that transforms natural language business workflow descriptions into complete, production-grade multi-agent pipeline specifications. Built with Next.js, Anthropic Claude, and Supabase.

It is a system that generates the blueprints for entire multi-agent systems from a single natural language input, then executes them with real tool integrations.

## How It Works

### Two-Layer Architecture

**Layer 1 — The Meta-Agent (the Factory)**
A single Claude API call using a comprehensive Pipeline Architect system prompt that receives a natural language workflow description, analyzes gaps, missing steps, and failure points, then outputs a complete, validated Pipeline Specification JSON.

**Layer 2 — The Pipeline Runtime (the Executor)**
An orchestration engine that reads a Pipeline Specification and executes it by spinning up individual Claude API calls per agent, injecting each agent's system prompt, tools, and guardrails, managing sequential and parallel execution flows, handling approval gates, retries, and failure policies, and streaming live status updates via Supabase Realtime.

### VPS Relay Architecture

Pipeline execution is offloaded to avoid Vercel serverless timeouts:

```
Browser → Vercel /api/runs (POST)
  ├─ Creates run record in Supabase
  ├─ Fires job to VPS relay → returns 202 immediately
  │
  VPS relay (Express on VPS, no timeout)
  ├─ Receives job
  └─ Calls back to Vercel /api/pipelines/[id]/execute (maxDuration=300s)
      └─ Runs full orchestrator → writes to Supabase → Realtime updates UI
```

When `VPS_RELAY_URL` is not set, pipelines execute locally (fire-and-forget) — preserving the local development experience with no VPS dependency.

## Features

- **Natural Language Pipeline Generation** — Describe a workflow in plain English and get a complete multi-agent pipeline spec
- **Pipeline Inspector** — Visual node graph (React Flow) with editable agent details, system prompts, tools, and guardrails
- **Live Execution Dashboard** — Real-time agent progress via Supabase Realtime with status streaming, approval gates, and input/output inspection
- **Run Cancellation** — Cancel running pipelines from the dashboard; orchestrator checks status between agent layers
- **Pipeline Templates** — 6 pre-built templates across Sales, Research, Productivity, and Marketing categories
- **Pipeline Duplication** — Clone any pipeline or template with one click
- **Workflow Discovery** — 3-step drill-down (departments, problems, pipeline preview) to generate zero-manual-input pipelines
- **Analytics Dashboard** — Token usage tracking, cost analysis, success rates, daily charts (Recharts), and paginated run history
- **8 Integration Suites** — Gmail, Google Calendar, Google Sheets, Brave Search, HubSpot CRM, Slack, Notion, and Custom API integrations
- **Custom Integrations** — API Tool Builder for connecting any REST API with auth support (API key, bearer, basic, OAuth2) and OpenAPI import
- **Credential Management** — Settings UI saves credentials to Supabase (Vercel-safe); no filesystem writes
- **Authentication & RBAC** — Supabase Auth with email/password login, admin/member roles, team management
- **Scheduled Triggers** — Cron-based automated pipeline execution
- **Webhook Triggers** — HTTP endpoint per pipeline for external integrations
- **Approval Gates** — Human-in-the-loop approval for irreversible actions, with optional Slack approval requests
- **Per-Agent Model Selection** — Choose different Claude models per pipeline or per agent (Haiku, Sonnet, Opus)
- **Rate Limiting** — Per-route sliding window rate limiting
- **Structured Error Handling** — 14 error codes with user-friendly messages, actionable fix instructions, and integration-aware diagnostics
- **Error Alerting** — Severity-classified error alerts recorded as system messages
- **Weekly Summary Reports** — Automated weekly metrics collection and report generation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router), TypeScript, Tailwind CSS |
| AI | Anthropic Claude via `@anthropic-ai/sdk` |
| Database | Supabase (Postgres + Realtime) |
| Auth | Supabase Auth with RBAC (admin/member roles) |
| Integrations | Direct API calls — `googleapis`, `@hubspot/api-client`, `@slack/web-api`, `@notionhq/client`, Brave REST |
| Custom APIs | Custom Integration builder with OAuth2 token refresh |
| Graph Visualization | React Flow (`@xyflow/react`) + dagre |
| Charts | Recharts |
| Icons | Lucide React |
| Validation | Zod |
| Scheduling | cron-parser |
| VPS Relay | Express on a VPS, PM2 process manager |

## Project Structure

```
src/
  app/
    page.tsx                          — Generate page (natural language input)
    not-found.tsx                     — Custom 404 page
    layout.tsx                        — Root layout with NavBar
    login/page.tsx                    — Login page (email/password)
    discover/page.tsx                 — Workflow Discovery (3-step drill-down)
    analytics/page.tsx                — Analytics dashboard
    pipelines/page.tsx                — Pipeline library
    pipelines/[id]/page.tsx           — Pipeline Inspector (graph + editor)
    runs/page.tsx                     — Runs list
    runs/new/page.tsx                 — Run input form
    runs/[id]/page.tsx                — Live run dashboard
    templates/page.tsx                — Template library
    settings/page.tsx                 — Integration settings, model config, team mgmt
    api/
      generate/route.ts              — POST: natural language → pipeline spec (SSE streaming)
      pipelines/route.ts             — GET/POST: list and save pipelines
      pipelines/[id]/route.ts        — GET/PATCH/POST: fetch, update, duplicate
      pipelines/[id]/execute/route.ts — POST: VPS relay callback (runs orchestrator, maxDuration=300)
      pipelines/[id]/runs/[runId]/
        cancel/route.ts              — POST: cancel a running pipeline
      runs/route.ts                  — GET/POST: list runs, start new run (fires to VPS relay)
      runs/[id]/route.ts             — GET: run details with messages and approvals
      approvals/route.ts             — POST: approve/reject approval gates
      analytics/route.ts             — GET: dashboard stats with period filter
      analytics/runs/route.ts        — GET: paginated run history
      templates/route.ts             — GET/POST: list templates, clone to pipeline
      scheduler/route.ts             — GET/POST: heartbeat + create triggers
      webhooks/[pipeline_id]/route.ts — POST: webhook-triggered runs (fires to VPS relay)
      settings/route.ts              — GET/POST: integration status + save to Supabase
      settings/test/route.ts         — POST: test integration connectivity (incl. VPS health)
      custom-integrations/           — CRUD for custom API integrations and tools
      integrations/slack/
        interactions/route.ts        — POST: Slack interactive message handler
      auth/callback/route.ts         — OAuth/magic link callback
      team/route.ts                  — GET/POST/DELETE: team management (admin only)
      system/weekly-report/route.ts  — POST: trigger weekly summary report
  components/
    NavBar.tsx                        — Top navigation with Lucide icons
    UserMenu.tsx                      — User avatar + sign out dropdown
    ui/                               — Shared UI: Card, Badge, Button, PageHeader, EmptyState, etc.
    generate/MetaBlock.tsx            — Gaps filled, assumptions, recommendations
    pipeline/PipelineGraph.tsx        — React Flow node graph with dagre layout
    pipeline/AgentCard.tsx            — Agent editor side panel
    runs/AgentStatusCard.tsx          — Per-agent status card with I/O
    runs/ApprovalGate.tsx             — Approval request UI
  lib/
    ai-config.ts                      — ANTHROPIC_MODEL constant (single source of truth)
    models.ts                         — Model registry (Haiku, Sonnet, Opus) with pricing
    meta-agent.ts                     — Pipeline Architect system prompt + generation
    orchestrator.ts                   — Pipeline execution engine with token tracking
    pipeline-validator.ts             — Zod-based spec validation
    pipeline-errors.ts                — Structured error codes + factory functions
    tool-registry.ts                  — Tool definitions in Anthropic SDK format
    mcp-client-manager.ts             — Tool routing to direct API integrations
    custom-tool-executor.ts           — Custom API tool execution with OAuth2 refresh
    settings-manager.ts               — Credential storage in Supabase + process.env sync
    discovery-data.ts                 — Workflow Discovery departments + problems
    google-auth.ts                    — Google OAuth2 client (Gmail, Calendar, Sheets)
    hubspot-auth.ts                   — HubSpot Private App client
    slack-auth.ts                     — Slack Web API client
    notion-auth.ts                    — Notion API client + direct REST helper
    integrations/
      gmail.ts                        — Gmail read, send, draft
      google-calendar.ts              — Calendar read, write, find slot
      google-sheets.ts                — Sheets read, write, update, create, search, format
      brave-search.ts                 — Web search, scrape, research
      hubspot.ts                      — Contacts, companies, deals, tasks, notes, email, pipelines
      slack.ts                        — Messages, DMs, notifications, approvals, channels
      notion.ts                       — Pages, databases, content blocks, search
    scheduler.ts                      — Cron-based trigger processing
    templates.ts                      — 6 pre-built pipeline templates
    weekly-report-pipeline.ts         — Weekly summary report spec generator
    rate-limiter.ts                   — Sliding window rate limiter
    error-alerting.ts                 — Error alerting with severity classification
    supabase.ts                       — Browser-side Supabase client
    supabase-server.ts                — Server-side Supabase client (Next.js cookies)
    supabase-middleware.ts            — Middleware Supabase client
    supabase-auth.ts                  — Auth-aware server client, getAuthUser(), getUserRole()
  types/
    pipeline.ts                       — Master TypeScript types + Zod schema
  middleware.ts                       — Route protection (redirects to /login)
  instrumentation.ts                  — Loads credentials from Supabase at server startup
vps-service/
  src/
    index.ts                          — Express relay server (/relay, /health)
    lib/supabase-server.ts            — VPS-compatible Supabase client (no cookies)
  setup.sh                            — One-time VPS setup script
  deploy.sh                           — PM2 deploy/restart script
supabase/
  migrations/
    001_initial_schema.sql            — pipelines, pipeline_runs, agent_messages, approval_requests
    002_scheduled_triggers.sql        — pipeline_scheduled_triggers
    003_analytics.sql                 — token_usage, pipeline_templates, analytics columns
    004_enable_realtime.sql           — Realtime subscriptions for agent_messages
    005_hubspot_credentials.sql       — HubSpot credential storage (legacy)
    006_run_errors.sql                — Structured error columns on pipeline_runs and agent_messages
    007_app_settings.sql              — App-wide credential storage (RLS service_role only)
    008_user_profiles.sql             — User profiles with auto-create trigger + RBAC
    009_custom_integrations.sql       — custom_integrations + custom_tools tables
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `pipelines` | Stores pipeline specifications (name, description, full JSON spec) |
| `pipeline_runs` | One record per execution (status, input data, token usage, cost, duration, structured errors) |
| `agent_messages` | Per-agent execution records for Realtime streaming |
| `approval_requests` | Human approval gates (pending/approved/rejected) |
| `pipeline_scheduled_triggers` | Cron-based scheduled triggers |
| `token_usage` | Per-agent token consumption tracking |
| `pipeline_templates` | Pre-built pipeline templates |
| `app_settings` | Credential storage (service_role access only, RLS-protected) |
| `user_profiles` | User accounts with role (admin/member) |
| `custom_integrations` | Custom API integration configs (base URL, auth, headers) |
| `custom_tools` | Custom API tools linked to integrations (method, path, parameters) |

## Available Tools

Agents can be assigned tools from these categories:

| Category | Tools |
|----------|-------|
| Communication | `gmail_read`, `gmail_send`, `gmail_draft`, `outlook_read`, `outlook_send` |
| Calendar | `google_calendar_read`, `google_calendar_write`, `google_calendar_find_slot` |
| Search & Research | `web_search`, `web_scrape`, `web_research` |
| Data | `supabase_read`, `supabase_write`, `json_transform` |
| HubSpot CRM | `hubspot_read_contacts`, `hubspot_write_contact`, `hubspot_read_companies`, `hubspot_write_company`, `hubspot_read_deals`, `hubspot_write_deal`, `hubspot_create_task`, `hubspot_create_note`, `hubspot_send_email`, `hubspot_read_pipeline_stages` |
| Google Sheets | `sheets_read_rows`, `sheets_write_rows`, `sheets_update_cells`, `sheets_create_spreadsheet`, `sheets_search`, `sheets_format_cells` |
| Slack | `slack_send_message`, `slack_send_dm`, `slack_post_notification`, `slack_request_approval`, `slack_create_channel`, `slack_read_messages` |
| Notion | `notion_create_page`, `notion_read_pages`, `notion_update_page`, `notion_append_content`, `notion_create_standalone_page`, `notion_search`, `notion_check_exists` |
| Custom | Any `custom_*` prefixed tool from the Custom Integrations builder |
| Utility | `human_approval_request`, `pipeline_notify`, `schedule_trigger` |

## Agent Archetypes

The Meta-Agent assigns agents from 33 archetypes: Ingestion, Enrichment, Validation, Transformation, Research, Analysis, Scoring, Classification, Copywriter, Outreach, Summarization, Report, Scheduler, Router, OrchestratorSub, QA, Compliance, Deduplication, Logging, Notification, Watchdog, DatabaseWriter, DatabaseReader, ContentCreator, PageCreator, DataSync, Notifier, MessageSender, CRMWriter, CRMReader, Aggregator, Formatter, Searcher.

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- An Anthropic API key

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd agent-pipeline-foundry
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` from the example:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your core environment variables in `.env.local`:
   ```
   ANTHROPIC_API_KEY=         # Your Anthropic API key
   ANTHROPIC_MODEL=           # Optional (defaults to claude-sonnet-4-5-20250929)
   NEXT_PUBLIC_SUPABASE_URL=  # Your Supabase project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon key
   SUPABASE_SERVICE_ROLE_KEY= # Supabase service role key
   ```

5. Run all database migrations in your Supabase SQL Editor (in order):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_scheduled_triggers.sql`
   - `supabase/migrations/003_analytics.sql`
   - `supabase/migrations/004_enable_realtime.sql`
   - `supabase/migrations/005_hubspot_credentials.sql`
   - `supabase/migrations/006_run_errors.sql`
   - `supabase/migrations/007_app_settings.sql`
   - `supabase/migrations/008_user_profiles.sql`
   - `supabase/migrations/009_custom_integrations.sql`

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

### VPS Relay Setup (Production)

To avoid Vercel serverless timeouts on long-running pipelines:

1. Deploy the relay service to your VPS:
   ```bash
   cd vps-service
   chmod +x setup.sh deploy.sh
   ./setup.sh
   # Edit .env with your secrets
   ./deploy.sh
   ```

2. Add these env vars to Vercel (and `.env.local`):
   ```
   VPS_RELAY_URL=http://your-vps-ip:4000
   VPS_SHARED_SECRET=your-shared-secret
   VPS_EXECUTE_SECRET=your-execute-secret
   ```

3. The relay service uses PM2 for process management:
   ```bash
   pm2 logs relay-service    # View logs
   pm2 restart relay-service # Restart
   pm2 monit                 # Monitor
   ```

When `VPS_RELAY_URL` is not set, pipelines execute locally — no VPS required for development.

### Integrations

Configure integrations in the **Settings** page (`/settings`). Credentials are stored in Supabase and loaded into the runtime automatically — no server restart required.

| Integration | Credentials Needed | Setup Guide |
|-------------|-------------------|-------------|
| **Gmail, Calendar & Sheets** | OAuth2 Client ID, Secret, Refresh Token | [Google Cloud Console](https://console.cloud.google.com) — refresh token must include gmail, calendar, spreadsheets, and drive.file scopes |
| **Brave Search** | API Key | [brave.com/search/api](https://brave.com/search/api/) |
| **HubSpot CRM** | Private App Access Token, Portal ID (optional) | HubSpot Settings → Integrations → Private Apps |
| **Slack** | Bot Token, Signing Secret, Approval Channel (optional) | [api.slack.com/apps](https://api.slack.com/apps) — scopes: `channels:read`, `channels:manage`, `chat:write`, `chat:write.public`, `im:write`, `users:read` |
| **Notion** | Internal Integration Secret | [notion.so/my-integrations](https://www.notion.so/my-integrations) — each database/page must be shared with the integration |
| **Custom APIs** | Varies (API key, bearer token, basic auth, OAuth2) | Settings → Custom Integrations → Add Integration |

You can also set credentials as environment variables (in `.env.local` or Vercel). Environment variables take precedence over Supabase-stored values.

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/generate` | Generate pipeline spec from natural language (SSE stream) |
| GET | `/api/pipelines` | List all pipelines |
| POST | `/api/pipelines` | Save a new pipeline |
| GET | `/api/pipelines/:id` | Get pipeline by ID |
| PATCH | `/api/pipelines/:id` | Update pipeline spec |
| POST | `/api/pipelines/:id` | Duplicate pipeline |
| POST | `/api/pipelines/:id/execute` | VPS relay callback — runs orchestrator (maxDuration=300) |
| POST | `/api/pipelines/:id/runs/:runId/cancel` | Cancel a running pipeline |
| POST | `/api/runs` | Start a new pipeline run (fires to VPS relay or runs locally) |
| GET | `/api/runs` | List recent runs |
| GET | `/api/runs/:id` | Get run details with agent messages and approvals |
| POST | `/api/approvals` | Approve or reject an approval gate |
| GET | `/api/analytics` | Dashboard stats (period filter: 7d, 30d, 90d, all) |
| GET | `/api/analytics/runs` | Paginated run history with filters |
| GET | `/api/templates` | List available templates |
| POST | `/api/templates` | Clone a template into a new pipeline |
| GET | `/api/scheduler` | Scheduler heartbeat (processes due triggers) |
| POST | `/api/scheduler` | Create a scheduled trigger |
| POST | `/api/webhooks/:pipeline_id` | Trigger a pipeline via webhook (fires to VPS relay) |
| GET | `/api/settings` | Get integration connection status |
| POST | `/api/settings` | Save integration credentials to Supabase |
| POST | `/api/settings/test` | Test integration connectivity (incl. VPS health check) |
| GET/POST/DELETE | `/api/custom-integrations` | CRUD for custom API integrations |
| POST | `/api/custom-integrations/import` | Import tools from OpenAPI spec |
| POST | `/api/custom-integrations/test` | Test custom tool execution |
| POST | `/api/integrations/slack/interactions` | Slack interactive message handler |
| GET/POST/DELETE | `/api/team` | Team management (admin only) |
| POST | `/api/system/weekly-report` | Trigger a weekly summary report |

## Rate Limits

| Route | Limit |
|-------|-------|
| `/api/generate` | 10 requests/minute |
| `/api/runs` (POST) | 20 requests/minute |
| `/api/scheduler` (GET) | 5 requests/minute |
| `/api/webhooks/:id` | 30 requests/minute per pipeline |

## Pipeline Templates

6 built-in templates available at `/templates`:

| Template | Category | Agents |
|----------|----------|--------|
| Customer Onboarding Email Sequence | Sales | 4 |
| Lead Research & Enrichment | Research | 3 |
| Daily Inbox Digest | Productivity | 3 |
| Meeting Notes Processor | Productivity | 3 |
| Weekly Competitor Monitor | Research | 3 |
| Content Publishing Pipeline | Marketing | 4 |
