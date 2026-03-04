import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// In production, credentials should be stored in a secrets manager
// (e.g. AWS Secrets Manager, HashiCorp Vault), not .env.local.
// This implementation is suitable for internal tooling only.

const ENV_FILE_PATH = path.join(process.cwd(), ".env.local");

const INTEGRATION_KEYS: Record<string, string[]> = {
  gmail: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"],
  google_calendar: [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
  ],
  brave_search: ["BRAVE_API_KEY"],
};

function isConfigured(keys: string[]): boolean {
  return keys.every((key) => {
    const value = process.env[key];
    return value !== undefined && value !== "" && value !== null;
  });
}

/**
 * GET — Returns connection status for each integration.
 * Never returns actual credential values.
 */
export async function GET() {
  try {
    return NextResponse.json(
      {
        gmail: { configured: isConfigured(INTEGRATION_KEYS.gmail) },
        google_calendar: {
          configured: isConfigured(INTEGRATION_KEYS.google_calendar),
        },
        brave_search: {
          configured: isConfigured(INTEGRATION_KEYS.brave_search),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — Updates credentials in .env.local for a given integration.
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

    const validIntegrations = Object.keys(INTEGRATION_KEYS);
    if (!validIntegrations.includes(integration)) {
      return NextResponse.json(
        {
          error: `Invalid integration. Must be one of: ${validIntegrations.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const allowedKeys = INTEGRATION_KEYS[integration];
    const updates: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (key in credentials) {
        updates[key] = credentials[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid credential keys provided." },
        { status: 400 }
      );
    }

    // Read current .env.local
    let envContent = "";
    try {
      envContent = await fs.readFile(ENV_FILE_PATH, "utf-8");
    } catch {
      // File doesn't exist yet — will be created
    }

    // Update or append each key
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent = envContent.trimEnd() + `\n${key}=${value}`;
      }
    }

    await fs.writeFile(ENV_FILE_PATH, envContent.trim() + "\n", "utf-8");

    return NextResponse.json(
      {
        message: `Credentials for ${integration} updated. Restart the dev server to apply changes.`,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
