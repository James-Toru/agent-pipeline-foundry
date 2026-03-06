import { createClient } from "@supabase/supabase-js";

// Use service role client — credentials are sensitive
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service role credentials not configured");
  }

  return createClient(url, key);
}

// Map of Supabase setting keys to environment variable names
export const CREDENTIAL_MAP: Record<string, string> = {
  // Google
  google_client_id: "GOOGLE_CLIENT_ID",
  google_client_secret: "GOOGLE_CLIENT_SECRET",
  google_refresh_token: "GOOGLE_REFRESH_TOKEN",

  // HubSpot
  hubspot_access_token: "HUBSPOT_ACCESS_TOKEN",
  hubspot_portal_id: "HUBSPOT_PORTAL_ID",

  // Slack
  slack_bot_token: "SLACK_BOT_TOKEN",
  slack_signing_secret: "SLACK_SIGNING_SECRET",
  slack_approval_channel: "SLACK_APPROVAL_CHANNEL",

  // Notion
  notion_api_key: "NOTION_API_KEY",

  // Brave
  brave_api_key: "BRAVE_API_KEY",

  // Anthropic
  anthropic_api_key: "ANTHROPIC_API_KEY",
};

/**
 * Save a credential to Supabase app_settings table.
 * Uses upsert so calling this again updates the value.
 */
export async function saveSetting(
  key: string,
  value: string
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase.from("app_settings").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(`Failed to save setting "${key}": ${error.message}`);
  }

  // Also update process.env immediately so the current process
  // picks up the new value without needing a restart
  const envKey = CREDENTIAL_MAP[key];
  if (envKey) {
    process.env[envKey] = value;
    console.log(`[Settings] Updated ${envKey} in process.env`);
  }
}

/**
 * Save multiple credentials at once.
 */
export async function saveSettings(
  settings: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    if (value && value.trim() !== "") {
      await saveSetting(key, value);
    }
  }
}

/**
 * Load all credentials from Supabase and inject them into process.env.
 *
 * Call this once at application startup.
 * Environment variables set in Vercel/local .env take precedence —
 * Supabase values only fill gaps.
 */
export async function loadSettingsIntoEnv(): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value");

    if (error) {
      console.warn(
        "[Settings] Could not load settings from Supabase:",
        error.message
      );
      return;
    }

    if (!data || data.length === 0) {
      console.log(
        "[Settings] No stored settings found in Supabase — using environment variables only"
      );
      return;
    }

    let loaded = 0;
    for (const { key, value } of data) {
      const envKey = CREDENTIAL_MAP[key];
      if (!envKey) continue;

      // Only set if not already set by Vercel env vars
      if (!process.env[envKey] && value) {
        process.env[envKey] = value;
        loaded++;
      }
    }

    console.log(
      `[Settings] Loaded ${loaded} credential(s) from Supabase into process.env`
    );
  } catch (error) {
    // Never crash on settings load failure
    console.warn(
      "[Settings] Settings load failed — continuing with existing env vars:",
      error instanceof Error ? error.message : String(error)
    );
  }
}
