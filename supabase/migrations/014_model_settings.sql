-- Seed the default model setting into app_settings.
-- The model field on pipelines and agents lives inside the spec JSONB column
-- and requires no schema change.

INSERT INTO app_settings (key, value, updated_at)
VALUES ('default_model', 'claude-sonnet-4-5-20250929', now())
ON CONFLICT (key) DO NOTHING;
