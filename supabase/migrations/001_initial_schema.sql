-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────────────────────
-- Function: auto-update updated_at timestamp
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: pipelines
-- Stores all generated pipeline specifications.
-- ──────────────────────────────────────────────────────────────────────────────

create table pipelines (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  spec        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table pipelines is 'Stores all generated pipeline specifications. The spec column holds the full Pipeline Specification JSON.';

create trigger pipelines_updated_at
  before update on pipelines
  for each row
  execute function update_updated_at_column();

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: pipeline_runs
-- One record per pipeline execution.
-- ──────────────────────────────────────────────────────────────────────────────

create table pipeline_runs (
  id            uuid primary key default uuid_generate_v4(),
  pipeline_id   uuid not null references pipelines(id) on delete cascade,
  status        text not null default 'pending',
  input_data    jsonb,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table pipeline_runs is 'One record per pipeline execution. Tracks run status and input/output data.';

create index idx_pipeline_runs_pipeline_id on pipeline_runs(pipeline_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: agent_messages
-- One record per agent execution within a run. Used for live streaming to frontend.
-- ──────────────────────────────────────────────────────────────────────────────

create table agent_messages (
  id            uuid primary key default uuid_generate_v4(),
  run_id        uuid not null references pipeline_runs(id) on delete cascade,
  agent_id      text not null,
  status        text not null default 'pending',
  input         jsonb,
  output        jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table agent_messages is 'One record per agent execution within a run. Used for live streaming status updates to the frontend via Supabase Realtime.';

create index idx_agent_messages_run_id on agent_messages(run_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: approval_requests
-- Stores pending human approval gates.
-- ──────────────────────────────────────────────────────────────────────────────

create table approval_requests (
  id          uuid primary key default uuid_generate_v4(),
  run_id      uuid not null references pipeline_runs(id) on delete cascade,
  agent_id    text not null,
  message     text not null,
  context     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending',
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table approval_requests is 'Stores pending human approval gates. When an agent requires approval, a row is inserted here and the pipeline run is paused.';

create index idx_approval_requests_run_id on approval_requests(run_id);
create index idx_approval_requests_status on approval_requests(status);

-- ──────────────────────────────────────────────────────────────────────────────
-- Row Level Security (permissive for internal tool)
-- ──────────────────────────────────────────────────────────────────────────────

alter table pipelines enable row level security;
alter table pipeline_runs enable row level security;
alter table agent_messages enable row level security;
alter table approval_requests enable row level security;

-- Permissive policies — allow all operations (internal tool, no public access)
create policy "Allow all on pipelines" on pipelines for all using (true) with check (true);
create policy "Allow all on pipeline_runs" on pipeline_runs for all using (true) with check (true);
create policy "Allow all on agent_messages" on agent_messages for all using (true) with check (true);
create policy "Allow all on approval_requests" on approval_requests for all using (true) with check (true);
