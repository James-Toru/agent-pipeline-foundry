import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSlackSigningSecret, getSlackClient } from "@/lib/slack-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/integrations/slack/interactions
 * Receives interactive component payloads from Slack (button clicks).
 * Verifies the Slack signature, updates the approval_requests table,
 * and edits the original Slack message to reflect the decision.
 */
export async function POST(request: NextRequest) {
  // ── 1. Read raw body (needed for signature verification) ─────────────────
  const rawBody = await request.text();

  // ── 2. Verify Slack signature ─────────────────────────────────────────────
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // Reject requests older than 5 minutes (replay attack protection)
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    return NextResponse.json({ error: "Request too old" }, { status: 403 });
  }

  try {
    const signingSecret = getSlackSigningSecret();
    const baseString = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto
      .createHmac("sha256", signingSecret)
      .update(baseString)
      .digest("hex");
    const expectedSig = `v0=${hmac}`;

    if (
      !crypto.timingSafeEqual(
        Buffer.from(expectedSig, "utf8"),
        Buffer.from(signature, "utf8")
      )
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
  }

  // ── 3. Parse Slack payload ────────────────────────────────────────────────
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  let payload: {
    type: string;
    actions: { action_id: string; value: string; block_id: string }[];
    message: { ts: string };
    channel: { id: string };
  };

  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.type !== "block_actions" || !payload.actions?.length) {
    return NextResponse.json({ ok: true });
  }

  const action = payload.actions[0];
  const approvalId = action.value;
  const decision = action.action_id === "approve" ? "approved" : "rejected";

  // ── 4. Update approval_requests in Supabase ───────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("approval_requests")
    .update({
      status: decision,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("status", "pending"); // idempotent — only update if still pending

  if (error) {
    console.error("[slack/interactions] Supabase update failed:", error.message);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  // ── 5. Edit the original Slack message to reflect the decision ────────────
  try {
    const client = getSlackClient();
    const decisionLabel = decision === "approved" ? "✅ Approved" : "❌ Rejected";
    await client.chat.update({
      channel: payload.channel.id,
      ts: payload.message.ts,
      text: `${decisionLabel} — this approval request has been resolved.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${decisionLabel}*\nThis approval request has been resolved.`,
          },
        },
      ],
    });
  } catch (err) {
    // Non-fatal — approval is already recorded in DB
    console.error("[slack/interactions] Message update failed:", err);
  }

  return NextResponse.json({ ok: true });
}
