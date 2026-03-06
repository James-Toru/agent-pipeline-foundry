import { WebClient } from "@slack/web-api";

export function isSlackConfigured(): boolean {
  return !!(
    process.env.SLACK_BOT_TOKEN &&
    process.env.SLACK_BOT_TOKEN.trim() !== ""
  );
}

export function getSlackClient(): WebClient {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error(
      "Slack is not configured. Add SLACK_BOT_TOKEN in Settings → Integrations."
    );
  }
  return new WebClient(token);
}

export function getSlackSigningSecret(): string {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "SLACK_SIGNING_SECRET is not configured. Add it in Settings → Integrations."
    );
  }
  return secret;
}

export function getSlackApprovalChannel(): string {
  return process.env.SLACK_APPROVAL_CHANNEL ?? "#agent-foundry-approvals";
}
