-- ──────────────────────────────────────────────────────────────────────────────
-- Table: token_usage
-- Tracks token consumption per agent execution within a run.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE token_usage (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id          uuid NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  agent_id        text NOT NULL,
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  total_tokens    integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd        numeric(10, 6) NOT NULL DEFAULT 0,
  model           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE token_usage IS 'Tracks token consumption per agent execution within a pipeline run. Used for cost analytics and usage dashboards.';

CREATE INDEX idx_token_usage_run_id ON token_usage(run_id);
CREATE INDEX idx_token_usage_created_at ON token_usage(created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: pipeline_templates
-- Pre-built pipeline specifications users can clone.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE pipeline_templates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  description     text,
  category        text NOT NULL,
  icon            text NOT NULL DEFAULT 'T',
  spec            jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pipeline_templates IS 'Pre-built pipeline specification templates that users can browse and clone into new pipelines.';

CREATE TRIGGER pipeline_templates_updated_at
  BEFORE UPDATE ON pipeline_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ──────────────────────────────────────────────────────────────────────────────
-- ALTER pipeline_runs — add analytics columns
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS total_tokens    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_usd  numeric(10, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms     integer;

COMMENT ON COLUMN pipeline_runs.total_tokens IS 'Sum of all input + output tokens consumed during this run.';
COMMENT ON COLUMN pipeline_runs.total_cost_usd IS 'Estimated total cost in USD for all API calls in this run.';
COMMENT ON COLUMN pipeline_runs.duration_ms IS 'Wall-clock duration of the run in milliseconds.';

-- Index for analytics queries by date
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs(started_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- Row Level Security (permissive for internal tool)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on token_usage"
  ON token_usage FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on pipeline_templates"
  ON pipeline_templates FOR ALL USING (true) WITH CHECK (true);
