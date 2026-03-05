// ── Brave Search Direct API Integration ──────────────────────────────────────

const BRAVE_BASE = "https://api.search.brave.com/res/v1";

interface BraveSearchResult {
  title: string;
  url: string;
  description?: string;
}

interface BraveSearchResponse {
  web?: { results?: BraveSearchResult[] };
}

function getBraveKey(): string {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("BRAVE_API_KEY not configured");
  return key;
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export async function braveWebSearch(
  input: Record<string, unknown>
): Promise<string> {
  const key = getBraveKey();
  const params = new URLSearchParams({
    q: input.query as string,
    count: String((input.max_results as number | undefined) ?? 5),
  });
  if (input.site) params.set("site", input.site as string);

  const res = await fetch(`${BRAVE_BASE}/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Search API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as BraveSearchResponse;
  const results = json.web?.results ?? [];

  return JSON.stringify({
    status: "success",
    results: results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description ?? "",
    })),
    count: results.length,
  });
}

export async function braveScrapePage(
  input: Record<string, unknown>
): Promise<string> {
  const url = input.url as string;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Agent-Foundry/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  // Strip HTML tags, collapse whitespace, truncate to 8 KB
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  return JSON.stringify({ status: "success", url, content: text });
}

export async function braveWebResearch(
  input: Record<string, unknown>
): Promise<string> {
  const depth = (input.depth as string | undefined) ?? "standard";
  const maxSources =
    (input.sources_limit as number | undefined) ??
    (depth === "deep" ? 8 : depth === "quick" ? 3 : 5);

  const searchResult = await braveWebSearch({
    query: input.topic,
    max_results: maxSources,
  });

  const parsed = JSON.parse(searchResult) as {
    results: Array<{ title: string; url: string; snippet: string }>;
  };

  return JSON.stringify({
    status: "success",
    topic: input.topic,
    sources: parsed.results,
    summary: `Research on "${input.topic}": ${parsed.results.length} sources found. Key findings: ${parsed.results
      .slice(0, 3)
      .map((r) => r.snippet)
      .filter(Boolean)
      .join("; ")}`,
  });
}
