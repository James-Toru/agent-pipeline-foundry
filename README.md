# Agent Foundry

A Pipeline Factory that transforms natural language business workflow descriptions into complete, production-grade multi-agent pipeline specifications. Built with Next.js, Anthropic Claude, and Supabase.

It is a system that generates the blueprints for entire multi-agent systems from a single natural language input, then executes them with real tool integrations.

## How It Works

### Two-Layer Architecture

**Layer 1 — The Meta-Agent (the Factory)**
A single Claude API call using a comprehensive Pipeline Architect system prompt that receives a natural language workflow description, analyzes gaps, missing steps, and failure points, then outputs a complete, validated Pipeline Specification JSON.

**Layer 2 — The Pipeline Runtime (the Executor)**
An orchestration engine that reads a Pipeline Specification and executes it by spinning up individual Claude API calls per agent, injecting each agent's system prompt, tools, and guardrails, managing sequential and parallel execution flows, handling approval gates, retries, and failure policies, and streaming live status updates via Supabase Realtime.

## Features

- **Natural Language Pipeline Generation** — Describe a workflow in plain English and get a complete multi-agent pipeline spec
- **Pipeline Inspector** — Visual node graph (React Flow) with editable agent details, system prompts, tools, and guardrails
- **Live Execution Dashboard** — Real-time agent progress via Supabase Realtime with status streaming, approval gates, and input/output inspection
- **Pipeline Templates** — 6 pre-built templates across Sales, Research, Productivity, and Marketing categories
- **Pipeline Duplication** — Clone any pipeline or template with one click
- **Analytics Dashboard** — Token usage tracking, cost analysis, success rates, daily charts (Recharts), and paginated run history
- **MCP Tool Integration** — Real tool execution via Model Context Protocol (Gmail, Google Calendar, Brave Search, Filesystem)
- **Scheduled Triggers** — Cron-based automated pipeline execution
- **Webhook Triggers** — HTTP endpoint per pipeline for external integrations
- **Approval Gates** — Human-in-the-loop approval for irreversible actions
- **Rate Limiting** — Per-route sliding window rate limiting
- **Error Alerting** — Severity-classified error alerts recorded as system messages
- **Weekly Summary Reports** — Automated weekly metrics collection and report generation
- **Integration Settings** — UI for configuring Gmail, Google Calendar, and Brave Search credentials

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router), TypeScript, Tailwind CSS |
| AI | Anthropic Claude via `@anthropic-ai/sdk` |
| Database | Supabase (Postgres + Realtime) |
| Tool Integration | MCP Servers via `@modelcontextprotocol/sdk` |
| Graph Visualization | React Flow (`@xyflow/react`) + dagre |
| Charts | Recharts |
| Validation | Zod |
| Scheduling | cron-parser |

## Project Structure

```
src/
  app/
    page.tsx                          — Generate page (natural language input)
    not-found.tsx                     — Custom 404 page
    layout.tsx                        — Root layout with NavBar
    analytics/page.tsx                — Analytics dashboard
    pipelines/page.tsx                — Pipeline library
    pipelines/[id]/page.tsx           — Pipeline Inspector (graph + editor)
    runs/page.tsx                     — Runs list
    runs/new/page.tsx                 — Run input form
    runs/[id]/page.tsx                — Live run dashboard
    templates/page.tsx                — Template library
    settings/page.tsx                 — Integration settings
    api/
      generate/route.ts              — POST: natural language → pipeline spec
      pipelines/route.ts             — GET/POST: list and save pipelines
      pipelines/[id]/route.ts        — GET/PATCH/POST: fetch, update, duplicate
      runs/route.ts                  — GET/POST: list runs, start new run
      runs/[id]/route.ts             — GET: run details with messages and approvals
      approvals/route.ts             — POST: approve/reject approval gates
      analytics/route.ts             — GET: dashboard stats with period filter
      analytics/runs/route.ts        — GET: paginated run history
      templates/route.ts             — GET/POST: list templates, clone to pipeline
      scheduler/route.ts             — GET/POST: heartbeat + create triggers
      webhooks/[pipeline_id]/route.ts — POST: webhook-triggered pipeline runs
      settings/route.ts              — GET/POST: integration connection status
      system/weekly-report/route.ts  — POST: trigger weekly summary report
  components/
    NavBar.tsx                        — Top navigation
    generate/MetaBlock.tsx            — Gaps filled, assumptions, recommendations
    pipeline/PipelineGraph.tsx        — React Flow node graph with dagre layout
    pipeline/AgentCard.tsx            — Agent editor side panel
    runs/AgentStatusCard.tsx          — Per-agent status card with I/O
    runs/ApprovalGate.tsx             — Approval request UI
  lib/
    ai-config.ts                      — ANTHROPIC_MODEL constant (single source of truth)
    meta-agent.ts                     — Pipeline Architect system prompt + generation
    orchestrator.ts                   — Pipeline execution engine with token tracking
    pipeline-validator.ts             — Zod-based spec validation
    tool-registry.ts                  — 17 tool definitions in Anthropic SDK format
    mcp-config.ts                     — MCP server configurations
    mcp-client-manager.ts            — MCP connection pool and tool execution
    scheduler.ts                      — Cron-based trigger processing
    templates.ts                      — 6 pre-built pipeline templates
    weekly-report-pipeline.ts         — Weekly summary report spec generator
    rate-limiter.ts                   — Sliding window rate limiter
    error-alerting.ts                 — Error alerting with severity classification
    supabase.ts                       — Browser-side Supabase client
    supabase-server.ts                — Server-side Supabase client
  types/
    pipeline.ts                       — Master TypeScript types + Zod schema
supabase/
  migrations/
    001_initial_schema.sql            — pipelines, pipeline_runs, agent_messages, approval_requests
    002_scheduled_triggers.sql        — pipeline_scheduled_triggers
    003_analytics.sql                 — token_usage, pipeline_templates, analytics columns
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `pipelines` | Stores pipeline specifications (name, description, full JSON spec) |
| `pipeline_runs` | One record per execution (status, input data, token usage, cost, duration) |
| `agent_messages` | Per-agent execution records for Realtime streaming |
| `approval_requests` | Human approval gates (pending/approved/rejected) |
| `pipeline_scheduled_triggers` | Cron-based scheduled triggers |
| `token_usage` | Per-agent token consumption tracking |
| `pipeline_templates` | Pre-built pipeline templates |

## Available Tools

Agents can be assigned tools from these categories:

| Category | Tools |
|----------|-------|
| Communication | `gmail_read`, `gmail_send`, `gmail_draft`, `outlook_read`, `outlook_send` |
| Calendar | `google_calendar_read`, `google_calendar_write`, `google_calendar_find_slot` |
| Search & Research | `web_search`, `web_scrape`, `web_research` |
| Data | `supabase_read`, `supabase_write`, `json_transform` |
| Utility | `human_approval_request`, `pipeline_notify`, `schedule_trigger` |

## Agent Archetypes

The Meta-Agent assigns agents from 21 archetypes: Ingestion, Enrichment, Validation, Transformation, Research, Analysis, Scoring, Classification, Copywriter, Outreach, Summarization, Report, Scheduler, Router, OrchestratorSub, QA, Compliance, Deduplication, Logging, Notification, Watchdog.

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

4. Fill in your environment variables in `.env.local`:
   ```
   ANTHROPIC_API_KEY=         # Your Anthropic API key
   ANTHROPIC_MODEL=           # Optional (defaults to claude-sonnet-4-5-20250929)
   NEXT_PUBLIC_SUPABASE_URL=  # Your Supabase project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon key
   SUPABASE_SERVICE_ROLE_KEY= # Supabase service role key
   ```

5. Run the database migrations in your Supabase SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_scheduled_triggers.sql`
   - `supabase/migrations/003_analytics.sql`

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

### Optional Integrations

Configure these in the Settings page (`/settings`) or directly in `.env.local`:

- **Gmail & Google Calendar** — OAuth2 credentials from Google Cloud Console
- **Brave Search** — API key from [brave.com/search/api](https://brave.com/search/api/)

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/generate` | Generate pipeline spec from natural language |
| GET | `/api/pipelines` | List all pipelines |
| POST | `/api/pipelines` | Save a new pipeline |
| GET | `/api/pipelines/:id` | Get pipeline by ID |
| PATCH | `/api/pipelines/:id` | Update pipeline spec |
| POST | `/api/pipelines/:id` | Duplicate pipeline |
| POST | `/api/runs` | Start a new pipeline run |
| GET | `/api/runs` | List recent runs |
| GET | `/api/runs/:id` | Get run details with agent messages and approvals |
| POST | `/api/approvals` | Approve or reject an approval gate |
| GET | `/api/analytics` | Dashboard stats (period filter: 7d, 30d, 90d, all) |
| GET | `/api/analytics/runs` | Paginated run history with filters |
| GET | `/api/templates` | List available templates |
| POST | `/api/templates` | Clone a template into a new pipeline |
| GET | `/api/scheduler` | Scheduler heartbeat (processes due triggers) |
| POST | `/api/scheduler` | Create a scheduled trigger |
| POST | `/api/webhooks/:pipeline_id` | Trigger a pipeline via webhook |
| GET | `/api/settings` | Get integration connection status |
| POST | `/api/settings` | Update integration credentials |
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

