-- Add custom_header to the allowed auth_type values.
-- The original table has no CHECK constraint (auth_type is plain text),
-- so this migration adds one covering all valid types.

ALTER TABLE custom_integrations
  DROP CONSTRAINT IF EXISTS custom_integrations_auth_type_check;

ALTER TABLE custom_integrations
  ADD CONSTRAINT custom_integrations_auth_type_check
  CHECK (auth_type IN (
    'none',
    'api_key',
    'bearer_token',
    'basic_auth',
    'oauth2',
    'custom_header'
  ));
