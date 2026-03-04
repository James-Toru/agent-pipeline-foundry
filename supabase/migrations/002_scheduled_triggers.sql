-- Scheduled triggers for automated pipeline execution
CREATE TABLE IF NOT EXISTS pipeline_scheduled_triggers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  cron_expression text NOT NULL,
  input_data jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient trigger evaluation
CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_due
  ON pipeline_scheduled_triggers (pipeline_id, is_active, next_run_at);

-- RLS
ALTER TABLE pipeline_scheduled_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to scheduled triggers"
  ON pipeline_scheduled_triggers
  FOR ALL
  USING (true)
  WITH CHECK (true);
