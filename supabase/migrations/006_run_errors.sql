-- Add structured error fields to pipeline_runs
ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS error_user_message text,
  ADD COLUMN IF NOT EXISTS error_action text,
  ADD COLUMN IF NOT EXISTS error_integration text,
  ADD COLUMN IF NOT EXISTS error_details jsonb;

-- Add structured error fields to agent_messages
ALTER TABLE agent_messages
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_user_message text,
  ADD COLUMN IF NOT EXISTS error_action text,
  ADD COLUMN IF NOT EXISTS error_details jsonb;
