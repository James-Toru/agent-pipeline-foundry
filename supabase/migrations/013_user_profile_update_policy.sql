-- Allow authenticated users to update their own must_reset_password flag.
-- This lets the reset-password page clear the flag directly from the browser client.

CREATE POLICY "Users can update own must_reset_password"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
