import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/google-auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string
): string {
  const lines: string[] = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push("", body);
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export async function gmailRead(
  input: Record<string, unknown>
): Promise<string> {
  const auth = getGoogleAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: input.query as string,
    maxResults: (input.max_results as number | undefined) ?? 10,
    labelIds: input.label ? [(input.label as string)] : undefined,
  });

  const messages = data.messages ?? [];

  const details = await Promise.all(
    messages.slice(0, 10).map(async (msg) => {
      const { data: detail } = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = detail.payload?.headers ?? [];
      return {
        id: msg.id,
        from: headers.find((h) => h.name === "From")?.value,
        subject: headers.find((h) => h.name === "Subject")?.value,
        date: headers.find((h) => h.name === "Date")?.value,
        snippet: detail.snippet,
      };
    })
  );

  return JSON.stringify({
    status: "success",
    emails: details,
    total: data.resultSizeEstimate ?? 0,
  });
}

export async function gmailSend(
  input: Record<string, unknown>
): Promise<string> {
  const auth = getGoogleAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const raw = buildRawEmail(
    input.to as string,
    input.subject as string,
    input.body as string,
    input.cc as string | undefined,
    input.bcc as string | undefined
  );

  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return JSON.stringify({
    status: "success",
    message_id: data.id,
    thread_id: data.threadId,
  });
}

export async function gmailDraft(
  input: Record<string, unknown>
): Promise<string> {
  const auth = getGoogleAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const raw = buildRawEmail(
    input.to as string,
    input.subject as string,
    input.body as string,
    input.cc as string | undefined
  );

  const { data } = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  return JSON.stringify({ status: "success", draft_id: data.id });
}
