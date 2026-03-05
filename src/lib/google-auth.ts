import { google } from "googleapis";

/**
 * Returns true if all required Google OAuth credentials are present in env.
 */
export function isGoogleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

/**
 * Creates a Google OAuth2 client pre-loaded with the refresh token from env.
 * Throws if credentials are missing — call isGoogleConfigured() first.
 */
export function getGoogleAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return client;
}
