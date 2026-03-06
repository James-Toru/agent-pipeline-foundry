-- Ensure the shared updated_at trigger function exists.
-- It is normally created in 001_initial_schema.sql, but we use
-- CREATE OR REPLACE so this migration works standalone as well.

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: custom_integrations
-- User-defined API integrations with auth configuration.
-- ──────────────────────────────────────────────────────────────────────────────

create table custom_integrations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  base_url    text not null,
  description text,
  auth_type   text not null default 'none',
  auth_config jsonb not null default '{}'::jsonb,
  headers     jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table custom_integrations is 'User-defined API integrations with base URL and auth configuration. Supports api_key, bearer_token, basic_auth, oauth2, and no auth.';

create trigger custom_integrations_updated_at
  before update on custom_integrations
  for each row
  execute function update_updated_at_column();

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: custom_tools
-- Individual API endpoints belonging to a custom integration.
-- ──────────────────────────────────────────────────────────────────────────────

create table custom_tools (
  id              uuid primary key default uuid_generate_v4(),
  integration_id  uuid not null references custom_integrations(id) on delete cascade,
  name            text not null,
  description     text not null,
  method          text not null default 'GET',
  path            text not null,
  parameters      jsonb not null default '{"path": [], "query": [], "body": []}'::jsonb,
  response_mapping jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table custom_tools is 'Individual API endpoints belonging to a custom integration. Each tool is callable by pipeline agents.';

create index idx_custom_tools_integration_id on custom_tools(integration_id);

create trigger custom_tools_updated_at
  before update on custom_tools
  for each row
  execute function update_updated_at_column();

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table custom_integrations enable row level security;
alter table custom_tools enable row level security;

create policy "Allow all on custom_integrations" on custom_integrations for all using (true) with check (true);
create policy "Allow all on custom_tools" on custom_tools for all using (true) with check (true);
