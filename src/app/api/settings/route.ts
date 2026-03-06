import { NextRequest, NextResponse } from "next/server";
import { isHubSpotConfigured } from "@/lib/hubspot-auth";
import { isSlackConfigured } from "@/lib/slack-auth";
import { isNotionConfigured } from "@/lib/notion-auth";
import { isGoogleConfigured } from "@/lib/google-auth";
import { saveSettings, CREDENTIAL_MAP } from "@/lib/settings-manager";

// Reverse map: ENV_VAR_NAME → supabase setting key
const ENV_TO_SETTING: Record<string, string> = {};
for (const [settingKey, envKey] of Object.entries(CREDENTIAL_MAP)) {
  ENV_TO_SETTING[envKey] = settingKey;
}

/**
 * GET — Returns connection status for each integration.
 * Never returns actual credential values.
 */
export async function GET() {
  return NextResponse.json(
    {
      gmail: { configured: isGoogleConfigured() },
      google_calendar: { configured: isGoogleConfigured() },
      brave_search: {
        configured: !!(process.env.BRAVE_API_KEY?.trim()),
      },
      hubspot: { configured: isHubSpotConfigured() },
      slack: { configured: isSlackConfigured() },
      notion: { configured: isNotionConfigured() },
    },
    { status: 200 }
  );
}

/**
 * POST — Saves credentials to Supabase app_settings table
 * and updates process.env immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integration, credentials } = body;

    if (!integration || !credentials) {
      return NextResponse.json(
        { error: "integration and credentials are required." },
        { status: 400 }
      );
    }

    // Convert env-var-keyed credentials to setting keys
    const settings: Record<string, string> = {};
    for (const [envKey, value] of Object.entries(credentials)) {
      if (typeof value !== "string" || value === "") continue;
      const settingKey = ENV_TO_SETTING[envKey];
      if (settingKey) {
        settings[settingKey] = value;
      }
    }

    if (Object.keys(settings).length === 0) {
      return NextResponse.json(
        { error: "No valid credential keys provided." },
        { status: 400 }
      );
    }

    await saveSettings(settings);

    return NextResponse.json(
      {
        message: `Credentials for ${integration} updated successfully.`,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
