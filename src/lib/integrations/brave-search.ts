// ── Brave Search Direct API Integration ──────────────────────────────────────

const BRAVE_BASE = "https://api.search.brave.com/res/v1";
const FETCH_TIMEOUT_MS = 10_000;
const TRANSIENT_CODES = new Set([429, 500, 502, 503, 504]);
const SERVICE_CODES = new Set([401, 402, 403]);

const SCRAPE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// ── Error Classification ─────────────────────────────────────────────────────

export type ToolErrorCategory = "service" | "request";

export class BraveToolError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number | undefined,
    public readonly errorCategory: ToolErrorCategory
  ) {
    super(message);
    this.name = "BraveToolError";
  }
}

// ── Fetch Helpers ────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 1
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (attempt < maxRetries && TRANSIENT_CODES.has(res.status)) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("fetchWithRetry exhausted");
}

// ── Internals ────────────────────────────────────────────────────────────────

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
  if (!key) throw new BraveToolError("BRAVE_API_KEY not configured", undefined, "service");
  return key;
}

function classifyHttpError(
  status: number,
  statusText: string,
  context: string
): BraveToolError {
  if (SERVICE_CODES.has(status)) {
    return new BraveToolError(
      `${context}: ${status} ${statusText}`,
      status,
      "service"
    );
  }
  return new BraveToolError(
    `${context}: ${status} ${statusText}`,
    status,
    "request"
  );
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

  const res = await fetchWithRetry(`${BRAVE_BASE}/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
  });

  if (!res.ok) {
    throw classifyHttpError(
      res.status,
      res.statusText,
      "Brave Search API error"
    );
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

  const res = await fetchWithRetry(url, {
    headers: SCRAPE_HEADERS,
  });

  if (!res.ok) {
    // Scrape errors are always request-level (one URL failing ≠ all URLs failing)
    throw new BraveToolError(
      `Failed to scrape ${url}: ${res.status} ${res.statusText}`,
      res.status,
      "request"
    );
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

  // Let BraveToolError propagate (preserves errorCategory)
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
