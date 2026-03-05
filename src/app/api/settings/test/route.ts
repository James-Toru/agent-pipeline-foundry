import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { isGoogleConfigured, getGoogleAuthClient } from "@/lib/google-auth";

/**
 * POST /api/settings/test
 * Body: { integration: "gmail" | "google_calendar" | "brave_search" }
 * Tests real API connectivity with the credentials in process.env.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integration } = body as { integration: string };

    switch (integration) {
      case "gmail": {
        if (!isGoogleConfigured()) {
          return NextResponse.json(
            { success: false, error: "Google credentials not configured." },
            { status: 200 }
          );
        }
        const auth = getGoogleAuthClient();
        const gmail = google.gmail({ version: "v1", auth });
        const { data } = await gmail.users.getProfile({ userId: "me" });
        return NextResponse.json({
          success: true,
          message: `Connected as ${data.emailAddress} (${data.messagesTotal ?? 0} messages)`,
        });
      }

      case "google_calendar": {
        if (!isGoogleConfigured()) {
          return NextResponse.json(
            { success: false, error: "Google credentials not configured." },
            { status: 200 }
          );
        }
        const auth = getGoogleAuthClient();
        const calendar = google.calendar({ version: "v3", auth });
        const { data } = await calendar.calendarList.list({ maxResults: 1 });
        const count = data.items?.length ?? 0;
        return NextResponse.json({
          success: true,
          message: `Connected — ${count} calendar${count !== 1 ? "s" : ""} accessible`,
        });
      }

      case "brave_search": {
        const key = process.env.BRAVE_API_KEY;
        if (!key) {
          return NextResponse.json(
            { success: false, error: "BRAVE_API_KEY not configured." },
            { status: 200 }
          );
        }
        const res = await fetch(
          "https://api.search.brave.com/res/v1/web/search?q=test&count=1",
          {
            headers: {
              Accept: "application/json",
              "X-Subscription-Token": key,
            },
          }
        );
        if (!res.ok) {
          return NextResponse.json(
            {
              success: false,
              error: `Brave API returned ${res.status}: ${res.statusText}`,
            },
            { status: 200 }
          );
        }
        return NextResponse.json({
          success: true,
          message: "Brave Search API key is valid",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown integration: ${integration}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection test failed";
    return NextResponse.json({ success: false, error: message }, { status: 200 });
  }
}
