-- App-wide credential storage (replaces .env.local writes)
-- Only the service role can read/write this table

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON app_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS app_settings_key_idx
  ON app_settings (key);
