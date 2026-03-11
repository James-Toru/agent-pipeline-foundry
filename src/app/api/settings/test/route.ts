import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { isGoogleConfigured, getGoogleAuthClient } from "@/lib/google-auth";
import { isHubSpotConfigured, getHubSpotClient } from "@/lib/hubspot-auth";
import { isSlackConfigured, getSlackClient } from "@/lib/slack-auth";
import { isNotionConfigured, testNotionConnection } from "@/lib/notion-auth";

/**
 * POST /api/settings/test
 * Body: { integration: "gmail" | "google_calendar" | "brave_search" | "hubspot" }
 * Tests real API connectivity with the stored credentials.
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

      case "hubspot": {
        if (!isHubSpotConfigured()) {
          return NextResponse.json(
            { success: false, error: "HUBSPOT_ACCESS_TOKEN not configured." },
            { status: 200 }
          );
        }
        const client = getHubSpotClient();
        const response = await client.crm.contacts.basicApi.getPage(1);
        const total = response.results?.length ?? 0;
        return NextResponse.json({
          success: true,
          message: `HubSpot connected — retrieved contacts successfully (${total} returned)`,
        });
      }

      case "slack": {
        if (!isSlackConfigured()) {
          return NextResponse.json(
            { success: false, error: "SLACK_BOT_TOKEN not configured." },
            { status: 200 }
          );
        }
        const client = getSlackClient();
        const res = await client.auth.test();
        return NextResponse.json({
          success: true,
          message: `Connected as @${res.user} (workspace: ${res.team})`,
        });
      }

      case "notion": {
        if (!isNotionConfigured()) {
          return NextResponse.json(
            { success: false, error: "NOTION_API_KEY not configured." },
            { status: 200 }
          );
        }
        const notionResult = await testNotionConnection();
        return NextResponse.json({
          success: notionResult.success,
          message: notionResult.message,
          ...(notionResult.success ? {} : { error: notionResult.message }),
        });
      }

      case "vps": {
        const vpsUrl = process.env.VPS_RELAY_URL;
        if (!vpsUrl) {
          return NextResponse.json(
            {
              success: false,
              error: "VPS_RELAY_URL not configured. Pipelines run locally.",
            },
            { status: 200 }
          );
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(`${vpsUrl}/health`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!res.ok) {
            return NextResponse.json(
              {
                success: false,
                error: `VPS returned ${res.status}: ${res.statusText}`,
              },
              { status: 200 }
            );
          }
          const data = await res.json();
          return NextResponse.json({
            success: true,
            message: `VPS connected — uptime ${Math.round(data.uptime ?? 0)}s`,
          });
        } catch (fetchErr) {
          clearTimeout(timeout);
          const msg =
            fetchErr instanceof Error ? fetchErr.message : "VPS unreachable";
          return NextResponse.json(
            { success: false, error: msg },
            { status: 200 }
          );
        }
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
