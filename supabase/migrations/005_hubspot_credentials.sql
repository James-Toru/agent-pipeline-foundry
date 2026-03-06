-- ── HubSpot Credentials ──────────────────────────────────────────────────────
-- Stores OAuth2 tokens for the connected HubSpot account.
-- Uses client_key = 'default' for single-tenant internal tooling.

CREATE TABLE IF NOT EXISTS hubspot_credentials (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key   text        NOT NULL DEFAULT 'default',
  access_token text        NOT NULL,
  refresh_token text       NOT NULL,
  expires_at   timestamptz NOT NULL,
  hub_domain   text,
  hub_id       text,
  scopes       text[],
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT hubspot_credentials_client_key_unique UNIQUE (client_key)
);

-- Auto-update updated_at on modification
CREATE OR REPLACE TRIGGER hubspot_credentials_updated_at
  BEFORE UPDATE ON hubspot_credentials
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- RLS: only server-side service role can access
ALTER TABLE hubspot_credentials ENABLE ROW LEVEL SECURITY;
