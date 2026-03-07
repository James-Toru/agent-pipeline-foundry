-- Track whether a user must reset their temporary password on first login.
-- Set to true when an admin creates a user, cleared after password change.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;
