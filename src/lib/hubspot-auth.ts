import { Client } from "@hubspot/api-client";

export function isHubSpotConfigured(): boolean {
  return !!(
    process.env.HUBSPOT_ACCESS_TOKEN &&
    process.env.HUBSPOT_ACCESS_TOKEN.trim() !== ""
  );
}

export function getHubSpotClient(): Client {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "HubSpot is not configured. Add HUBSPOT_ACCESS_TOKEN " +
        "to your environment variables or enter it in Settings."
    );
  }
  return new Client({ accessToken });
}

export function getHubSpotPortalId(): string | undefined {
  return process.env.HUBSPOT_PORTAL_ID || undefined;
}
