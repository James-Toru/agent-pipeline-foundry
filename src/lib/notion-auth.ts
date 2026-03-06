import { Client } from "@notionhq/client";

export function isNotionConfigured(): boolean {
  return !!(
    process.env.NOTION_API_KEY &&
    process.env.NOTION_API_KEY.trim() !== ""
  );
}

export function getNotionClient(): Client {
  const apiKey = process.env.NOTION_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Notion is not configured. Add NOTION_API_KEY " +
        "to your environment variables or enter it in Settings."
    );
  }

  return new Client({ auth: apiKey });
}

export async function notionFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY not configured");
  }

  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = (await response.json()) as any;
    throw new Error(error.message ?? `Notion API error: ${response.status}`);
  }

  return response.json();
}

export async function testNotionConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const client = getNotionClient();
    const response = await client.search({
      query: "",
      page_size: 1,
    });
    return {
      success: true,
      message: `Notion connected. Found ${response.results.length} result(s).`,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { success: false, message };
  }
}
