import { getSlackClient } from "@/lib/slack-auth";
import type { ToolExecutionResult } from "@/lib/mcp-client-manager";

// ── Channel resolution ────────────────────────────────────────────────────────

async function resolveChannel(channelInput: string): Promise<string> {
  const channelName = channelInput.replace(/^#/, "");

  // Already a channel ID (starts with C or G and is all caps/numbers)
  if (/^[CG][A-Z0-9]+$/.test(channelName)) {
    return channelName;
  }

  const client = getSlackClient();

  // Try to find the channel by listing conversations
  try {
    let cursor: string | undefined;
    do {
      const result = await client.conversations.list({
        limit: 200,
        cursor,
        types: "public_channel,private_channel",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = (result.channels ?? []).find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.name === channelName || c.name_normalized === channelName
      );

      if (found?.id) return found.id;

      cursor = result.response_metadata?.next_cursor ?? undefined;
    } while (cursor);
  } catch (e) {
    console.warn(
      "[Slack] Channel list failed, using channel name directly:",
      e instanceof Error ? e.message : e
    );
  }

  // Fallback: return the channel name — Slack often accepts #channel-name directly
  return channelInput;
}

async function tryJoinChannel(channelId: string): Promise<void> {
  try {
    const client = getSlackClient();
    await client.conversations.join({ channel: channelId });
  } catch {
    // Already a member or private channel — ignore
  }
}

// ── Tool functions ────────────────────────────────────────────────────────────

export async function slackSendMessage(input: {
  channel: string;
  text: string;
  thread_ts?: string;
}): Promise<ToolExecutionResult> {
  try {
    const client = getSlackClient();
    const channelId = await resolveChannel(input.channel);
    await tryJoinChannel(channelId);
    const res = await client.chat.postMessage({
      channel: channelId,
      text: input.text,
      ...(input.thread_ts ? { thread_ts: input.thread_ts } : {}),
    });
    return { success: true, result: `Message sent to ${input.channel} (ts: ${res.ts})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, fallback: `Failed to send Slack message: ${msg}` };
  }
}

export async function slackSendDM(input: {
  user_id: string;
  text: string;
}): Promise<ToolExecutionResult> {
  try {
    const client = getSlackClient();
    const { channel } = await client.conversations.open({ users: input.user_id });
    if (!channel?.id) throw new Error("Could not open DM channel");
    const res = await client.chat.postMessage({ channel: channel.id, text: input.text });
    return { success: true, result: `DM sent to user ${input.user_id} (ts: ${res.ts})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, fallback: `Failed to send Slack DM: ${msg}` };
  }
}

export async function slackPostNotification(input: {
  channel: string;
  title: string;
  body: string;
  color?: "good" | "warning" | "danger";
}): Promise<ToolExecutionResult> {
  try {
    const client = getSlackClient();
    const channelId = await resolveChannel(input.channel);
    await tryJoinChannel(channelId);
    const res = await client.chat.postMessage({
      channel: channelId,
      text: input.title,
      attachments: [
        {
          color: input.color ?? "good",
          text: input.body,
          fallback: input.body,
        },
      ],
    });
    return { success: true, result: `Notification posted to ${input.channel} (ts: ${res.ts})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, fallback: `Failed to post Slack notification: ${msg}` };
  }
}

export async function slackRequestApproval(input: {
  channel: string;
  approval_id: string;
  title: string;
  context: string;
}): Promise<ToolExecutionResult> {
  try {
    const client = getSlackClient();
    const channelId = await resolveChannel(input.channel);
    await tryJoinChannel(channelId);
    const res = await client.chat.postMessage({
      channel: channelId,
      text: `Approval required: ${input.title}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `Approval Required: ${input.title}`.slice(0, 150),
            emoji: true,
          },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: input.context.slice(0, 3000) },
        },
        {
          type: "actions",
          block_id: `approval_${input.approval_id}`,
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Approve", emoji: true },
              style: "primary",
              action_id: "approve",
              value: input.approval_id,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Reject", emoji: true },
              style: "danger",
              action_id: "reject",
              value: input.approval_id,
            },
          ],
        },
      ],
    });
    return {
      success: true,
      result: `Approval request sent to ${input.channel} (ts: ${res.ts}, approval_id: ${input.approval_id})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
      fallback: `Failed to send Slack approval request: ${msg}`,
    };
  }
}

export async function slackCreateChannel(input: {
  name: string;
  is_private?: boolean;
}): Promise<ToolExecutionResult> {
  try {
    const client = getSlackClient();
    const res = await client.conversations.create({
      name: input.name.toLowerCase().replace(/\s+/g, "-"),
      is_private: input.is_private ?? false,
    });
    const id = res.channel?.id ?? "unknown";
    return { success: true, result: `Channel #${input.name} created (id: ${id})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, fallback: `Failed to create Slack channel: ${msg}` };
  }
}

export async function slackReadMessages(input: {
  channel: string;
  limit?: number;
}): Promise<ToolExecutionResult> {
  try {
    const client = getSlackClient();
    const channelId = await resolveChannel(input.channel);
    await tryJoinChannel(channelId);
    const res = await client.conversations.history({
      channel: channelId,
      limit: input.limit ?? 10,
    });
    const messages = (res.messages ?? []).map((m) => ({
      ts: m.ts,
      user: m.user ?? "unknown",
      text: m.text ?? "",
    }));
    return { success: true, result: JSON.stringify(messages) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, fallback: `Failed to read Slack messages: ${msg}` };
  }
}
