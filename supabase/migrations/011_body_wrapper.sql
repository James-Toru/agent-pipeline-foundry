-- Add body_wrapper column to custom_integrations.
-- When set (e.g. "data"), the executor wraps POST/PUT/PATCH bodies as { "data": { ...params } }.
-- Used by Frappe/ERPNext and similar APIs.

ALTER TABLE custom_integrations
  ADD COLUMN IF NOT EXISTS body_wrapper text DEFAULT NULL;
