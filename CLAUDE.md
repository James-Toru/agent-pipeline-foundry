# Agent Foundry — Claude Code Project Context

## What This Project Is
Agent Foundry is a Pipeline Factory — a system that transforms natural language 
business workflow descriptions into complete, production-grade Multi-Agent Pipeline 
specifications that can be inspected, customized, and repeatedly deployed.

It is NOT an agent framework like CrewAI or AutoGen.
It is NOT a drag-and-drop tool like Zapier or n8n.
It IS a system that generates the blueprints for entire multi-agent systems 
from a single natural language input.

---

## Model & Framework Policy

**Anthropic Model:**
Never hardcode a specific model string anywhere in the codebase.
The active model is always read from the environment variable `ANTHROPIC_MODEL`.
If the variable is not set, fall back to the latest generally available Claude Sonnet model
by checking the Anthropic API or docs at https://docs.claude.com.
All Anthropic API calls across the entire codebase must reference this single constant:

```typescript
// /src/lib/ai-config.ts
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929';
```

Import `ANTHROPIC_MODEL` from this file wherever an API call is made.
Never inline a model string. Never duplicate it.

**Next.js Version:**
Use the latest stable version of Next.js at the time of scaffolding.
Do not pin to a specific version in documentation or comments.
Always use the App Router pattern (not Pages Router).
Check https://nextjs.org for the current stable release if uncertain.

---

## The Two-Layer Architecture

### Layer 1 — The Meta-Agent (the Factory)
A single Claude API call using the Pipeline Architect system prompt that:
- Receives a natural language workflow description from the user
- Analyzes gaps, missing steps, and failure points the user didn't mention
- Outputs a complete, validated Pipeline Specification JSON

The Meta-Agent system prompt lives in: /src/lib/meta-agent.ts
It is passed as the `system` parameter on every pipeline generation API call.
It is NEVER modified at runtime. It is a constant.

### Layer 2 — The Pipeline Runtime (the Executor)
An orchestration engine that reads a Pipeline Specification JSON and executes it by:
- Spinning up individual Claude API calls per agent
- Injecting each agent's system_prompt, tools, and guardrails from the spec
- Managing sequential and parallel execution flows
- Handling approval gates, retries, and failure policies
- Streaming live status updates to the frontend via Supabase Realtime

The runtime orchestrator lives in: /src/lib/orchestrator.ts

---

## Tech Stack

- **Framework:** Next.js (latest stable, App Router), TypeScript, Tailwind CSS
- **AI:** Anthropic API — model always sourced from `ANTHROPIC_MODEL` constant in /src/lib/ai-config.ts
- **Database:** Supabase (Postgres + Realtime subscriptions)
- **Tool Integration:** MCP Servers (Gmail, Google Calendar, Web Search)
- **Deployment:** Internal tool for TYTOS GmbH

---

## Project File Structure

```
/src
  /app
    /api
      /generate/route.ts        — POST: takes natural language, returns pipeline spec
      /run/route.ts             — POST: takes pipeline_id, executes the pipeline
      /pipelines/route.ts       — GET/POST: list and save pipelines
      /approvals/route.ts       — POST: handle human approval gate responses
    /page.tsx                   — Generate view (chat interface with Meta-Agent)
    /pipelines/page.tsx         — Pipeline library (list of saved pipelines)
    /pipelines/[id]/page.tsx    — Inspect view (node graph + agent editor)
    /runs/[id]/page.tsx         — Run dashboard (live execution view)
  /components
    /generate
      ChatInterface.tsx         — Natural language input + streaming Meta-Agent response
      PipelinePreview.tsx       — JSON spec preview before saving
      MetaBlock.tsx             — Displays gaps filled, assumptions, recommendations
    /pipeline
      PipelineGraph.tsx         — React Flow node graph visualizing agent flow
      AgentCard.tsx             — Editable agent details (prompt, tools, approval toggle)
      OrchestrationPanel.tsx    — Flow editor, parallel groups, conditions
    /runs
      RunTimeline.tsx           — Live agent execution timeline
      AgentOutput.tsx           — Per-agent input/output display
      ApprovalGate.tsx          — Human approval request UI
  /lib
    ai-config.ts                — ANTHROPIC_MODEL constant (single source of truth for model)
    meta-agent.ts               — Pipeline Architect system prompt + Meta-Agent API call
    orchestrator.ts             — Pipeline execution engine
    supabase.ts                 — Supabase client (browser)
    supabase-server.ts          — Supabase client (server/API routes)
    pipeline-validator.ts       — Validates generated specs against the TypeScript schema
    tool-registry.ts            — MCP tool definitions and injection logic
  /types
    pipeline.ts                 — Master TypeScript types for Pipeline Specification v1.0
    supabase.ts                 — Generated Supabase database types
```

---

## The Pipeline Specification Schema

The Pipeline Specification is the central contract of the entire system.
The TypeScript types in /src/types/pipeline.ts are the single source of truth.
The Supabase schema, the Meta-Agent output format, and the runtime orchestrator 
must all stay in sync with these types at all times.

Key fields every pipeline spec contains:
- `pipeline_id` — UUID v4
- `name` and `description` — human-readable identifiers
- `triggers` — manual | webhook | schedule
- `input_schema` — typed fields required to start the pipeline
- `agents[]` — array of agent definitions (see Agent Shape below)
- `orchestration.flow[]` — directed edges between agents with optional conditions
- `orchestration.parallel_groups[]` — groups of agents that run concurrently
- `error_handling` — global fallback, retry policy, alert settings
- `meta` — gaps filled, assumptions made, recommended enhancements

### Agent Shape (inside agents[])
Each agent contains:
- `agent_id` — snake_case unique identifier
- `archetype` — must match an archetype from the Agent Archetypes Library
- `role` — human-readable name
- `system_prompt` — complete instructions for this agent (minimum 100 words)
- `tools[]` — only tools this agent strictly requires (from Tool Registry)
- `inputs` / `outputs` — typed data contracts between agents
- `requires_approval` — boolean, true for any irreversible external action
- `approval_message` — message shown to human when approval is requested
- `on_failure` — retry_3x_then_notify | skip_and_continue | halt_pipeline | escalate_to_human
- `guardrails` — max_tokens, max_runtime_seconds, temperature

---

## Available Tools (Tool Registry)

Only these tools exist. Never assign tools outside this list to any agent.

### Communication
- `gmail_read` — Read/search Gmail inbox
- `gmail_send` — Send emails via Gmail
- `gmail_draft` — Create Gmail drafts
- `outlook_read` — Read/search Outlook inbox
- `outlook_send` — Send emails via Outlook

### Calendar
- `google_calendar_read` — Read events, check availability
- `google_calendar_write` — Create/update/cancel events
- `google_calendar_find_slot` — Find available time slots

### Search & Research
- `web_search` — Targeted web searches
- `web_scrape` — Extract content from URLs
- `web_research` — Multi-step research synthesis

### Data
- `supabase_read` — Query Supabase tables
- `supabase_write` — Write to Supabase tables
- `json_transform` — Transform JSON data structures

### Utility
- `human_approval_request` — Pause pipeline, request human approval
- `pipeline_notify` — Send notification to Agent Foundry dashboard
- `schedule_trigger` — Set time-based trigger for pipeline resumption

---

## Supabase Database Tables

### pipelines
Stores all generated pipeline specifications.
- `id` uuid PRIMARY KEY
- `name` text NOT NULL
- `description` text
- `spec` jsonb NOT NULL          — the full Pipeline Specification JSON
- `created_at` timestamptz
- `updated_at` timestamptz

### pipeline_runs
One record per pipeline execution.
- `id` uuid PRIMARY KEY
- `pipeline_id` uuid REFERENCES pipelines
- `status` text                  — pending | running | paused | completed | failed
- `input_data` jsonb             — the input values passed to this run
- `started_at` timestamptz
- `completed_at` timestamptz

### agent_messages
One record per agent execution within a run. Used for live streaming to frontend.
- `id` uuid PRIMARY KEY
- `run_id` uuid REFERENCES pipeline_runs
- `agent_id` text               — matches agent_id in the pipeline spec
- `status` text                  — pending | running | completed | failed | awaiting_approval
- `input` jsonb
- `output` jsonb
- `error` text
- `started_at` timestamptz
- `completed_at` timestamptz

### approval_requests
Stores pending human approval gates.
- `id` uuid PRIMARY KEY
- `run_id` uuid REFERENCES pipeline_runs
- `agent_id` text
- `message` text                 — the approval_message from the agent spec
- `context` jsonb                — the agent's output pending review
- `status` text                  — pending | approved | rejected
- `decided_at` timestamptz

---

## Critical Engineering Rules

1. **Types are the source of truth.** If the pipeline spec schema changes,
   update /src/types/pipeline.ts first, then update the DB migration,
   then update the Meta-Agent output format instructions.

2. **Model is sourced from ai-config.ts only.** Every Anthropic API call imports
   ANTHROPIC_MODEL from /src/lib/ai-config.ts. No model string ever appears
   anywhere else in the codebase. Switching models = changing one env variable.

3. **The Meta-Agent system prompt is a constant.** Never make it dynamic,
   never interpolate user data into it. User input goes in the `messages`
   array only.

4. **Validate before saving.** Every pipeline spec returned by the Meta-Agent
   must be validated against the TypeScript types via pipeline-validator.ts
   before being written to Supabase. Invalid specs are returned to the
   Meta-Agent for correction, not saved.

5. **Minimal tool access per agent.** The orchestrator must only inject tools
   listed in that agent's `tools[]` array. Never pass all tools to all agents.

6. **Supabase Realtime for live updates.** The Run Dashboard subscribes to
   the `agent_messages` table via Supabase Realtime. The orchestrator writes
   status updates to this table as agents progress. Do not use polling.

7. **Temperature is set per agent.** The orchestrator reads `guardrails.temperature`
   from each agent spec and passes it to the API call.
   Never use a global temperature setting.

8. **Approval gates pause the run.** When an agent has `requires_approval: true`,
   the orchestrator writes to `approval_requests`, sets the run status to
   `paused`, and halts execution. It resumes only when the approval record
   is updated to `approved` via the /api/approvals route.

9. **Parallel groups use Promise.all.** When the orchestrator encounters a
   `parallel_group`, it fires all agents in the group simultaneously using
   Promise.all and waits for all to complete before proceeding.

10. **Every agent has a timeout.** The orchestrator enforces
    `guardrails.max_runtime_seconds` per agent. If exceeded, apply the
    agent's `on_failure` policy.

11. **The meta block is always displayed.** After pipeline generation, the
    frontend must show the `meta.gaps_filled`, `meta.assumptions`, and
    `meta.recommended_enhancements` fields prominently. This is a core
    product feature, not a debug output.

12. **No version pinning in documentation.** Never reference specific version
    numbers for Next.js, Tailwind, or other dependencies in comments or docs.
    Let package.json and lockfiles manage versions.

---

## Environment Variables

The following environment variables must be present. Define them in .env.local.
Never commit .env.local to version control.

```
ANTHROPIC_API_KEY=           — Anthropic API key
ANTHROPIC_MODEL=             — Optional override. Falls back to claude-sonnet-latest.
NEXT_PUBLIC_SUPABASE_URL=    — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= — Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=   — Supabase service role key (server-side only)
```

---

## Commands Reference

When asked to build features, follow this priority order:
1. Define or update TypeScript types first
2. Write or update Supabase migration
3. Build the API route
4. Build the lib/utility function
5. Build the UI component last

When generating Supabase migrations, always use raw SQL files in /supabase/migrations/.
Never use the Supabase dashboard to make schema changes directly.

When building API routes, always use Next.js App Router format (route.ts with
named exports GET, POST, etc).

When building UI components, use Tailwind utility classes only.
No custom CSS files. No CSS modules.