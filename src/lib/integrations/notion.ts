import {
  getNotionClient,
  isNotionConfigured,
  notionFetch,
} from "@/lib/notion-auth";
import type { ToolExecutionResult } from "@/lib/mcp-client-manager";

// ── ID Formatter ──────────────────────────────────────────────────────────────

// Notion IDs from URLs have no hyphens.
// The API accepts both formats but to be safe
// always normalise to the hyphenated UUID format.
function formatNotionId(id: string): string {
  const clean = id.replace(/-/g, "").trim();
  if (clean.length !== 32) return id; // return as-is if unexpected length
  return [
    clean.slice(0, 8),
    clean.slice(8, 12),
    clean.slice(12, 16),
    clean.slice(16, 20),
    clean.slice(20),
  ].join("-");
}

// ── Rich Text Helpers ─────────────────────────────────────────────────────────

function toRichText(text: string) {
  return [{ type: "text" as const, text: { content: String(text) } }];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRichText(richText: any[]): string {
  if (!Array.isArray(richText)) return "";
  return richText
    .map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => t?.plain_text ?? t?.text?.content ?? ""
    )
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPropertyValue(property: any): string {
  if (!property) return "";
  switch (property.type) {
    case "title":
      return fromRichText(property.title ?? []);
    case "rich_text":
      return fromRichText(property.rich_text ?? []);
    case "number":
      return String(property.number ?? "");
    case "select":
      return property.select?.name ?? "";
    case "multi_select":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (property.multi_select ?? []).map((s: any) => s.name).join(", ");
    case "date":
      return property.date?.start ?? "";
    case "checkbox":
      return String(property.checkbox ?? false);
    case "url":
      return property.url ?? "";
    case "email":
      return property.email ?? "";
    case "phone_number":
      return property.phone_number ?? "";
    case "status":
      return property.status?.name ?? "";
    case "people":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (property.people ?? []).map((p: any) => p.name).join(", ");
    default:
      return "";
  }
}

// ── Block Helpers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textToBlocks(content: string): any[] {
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      if (line.startsWith("# "))
        return {
          object: "block",
          type: "heading_1",
          heading_1: { rich_text: toRichText(line.slice(2)) },
        };
      if (line.startsWith("## "))
        return {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: toRichText(line.slice(3)) },
        };
      if (line.startsWith("### "))
        return {
          object: "block",
          type: "heading_3",
          heading_3: { rich_text: toRichText(line.slice(4)) },
        };
      if (line.startsWith("- "))
        return {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: toRichText(line.slice(2)) },
        };
      if (/^\d+\. /.test(line))
        return {
          object: "block",
          type: "numbered_list_item",
          numbered_list_item: {
            rich_text: toRichText(line.replace(/^\d+\. /, "")),
          },
        };
      return {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: toRichText(line) },
      };
    });
}

// ── Property Builder (schema-aware) ───────────────────────────────────────────

function buildNotionProperty(
  type: string,
  value: unknown
): unknown {
  const str = String(value ?? "");
  switch (type) {
    case "title":
      return { title: toRichText(str) };
    case "rich_text":
      return { rich_text: toRichText(str) };
    case "number":
      return { number: Number(value) };
    case "select":
      return { select: { name: str } };
    case "multi_select":
      return {
        multi_select: Array.isArray(value)
          ? (value as unknown[]).map((v) => ({ name: String(v) }))
          : str.split(",").map((v) => ({ name: v.trim() })),
      };
    case "status":
      return { status: { name: str } };
    case "date":
      return { date: { start: str } };
    case "checkbox":
      return {
        checkbox: value === true || str.toLowerCase() === "true",
      };
    case "email":
      return { email: str };
    case "phone_number":
      return { phone_number: str };
    case "url":
      return { url: str };
    default:
      return { rich_text: toRichText(str) };
  }
}

// ── Fallback Helper ───────────────────────────────────────────────────────────

function notionFallback(
  operation: string,
  details: Record<string, unknown>
): ToolExecutionResult {
  return {
    success: false,
    error: `Notion ${operation} failed`,
    fallback: JSON.stringify({ ...details, simulated: true }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED TOOL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Create Page ───────────────────────────────────────────────────────────────

export async function notionCreatePage(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  if (!isNotionConfigured()) {
    return notionFallback("createPage", {
      summary: "Notion not configured",
      page_id: null,
      created: false,
    });
  }

  try {
    const notion = getNotionClient();
    const databaseId = formatNotionId(String(input.database_id));
    const inputProps = (input.properties ?? {}) as Record<string, unknown>;

    // Step 1: Fetch the real database schema
    console.log("[Notion] Fetching schema for database:", databaseId);

    // Use direct REST API — the SDK's databases.retrieve() drops the properties field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const database = (await notionFetch(`/databases/${databaseId}`)) as any;

    // Log the raw response shape for debugging
    console.log(
      "[Notion] databases.retrieve response keys:",
      Object.keys(database)
    );
    console.log(
      "[Notion] database.properties type:",
      typeof database.properties
    );
    console.log(
      "[Notion] database.properties value:",
      JSON.stringify(database.properties, null, 2)?.substring(0, 500)
    );

    const rawSchema = database.properties;
    if (
      !rawSchema ||
      typeof rawSchema !== "object" ||
      Object.keys(rawSchema).length === 0
    ) {
      console.error(
        "[Notion] Full database response:",
        JSON.stringify(database, null, 2)
      );
      throw new Error(
        `Database schema empty for ID: ${databaseId}. ` +
          "Raw response logged above. " +
          "Confirm the database is shared with the Agent Foundry integration."
      );
    }

    const dbSchema = rawSchema as Record<string, { type: string }>;

    console.log(
      "[Notion] Schema columns:",
      Object.entries(dbSchema)
        .map(([k, v]) => `${k}(${v.type})`)
        .join(", ")
    );

    // Step 2: Build properties from input, mapped to schema types
    const properties: Record<string, unknown> = {};
    let titleWasSet = false;

    for (const [inputKey, inputValue] of Object.entries(inputProps)) {
      // Find matching column (exact first, then case-insensitive)
      const schemaKey =
        Object.keys(dbSchema).find((k) => k === inputKey) ??
        Object.keys(dbSchema).find(
          (k) => k.toLowerCase() === inputKey.toLowerCase()
        );

      if (!schemaKey) {
        console.warn(
          `[Notion] Column "${inputKey}" not found in schema. ` +
            `Available: ${Object.keys(dbSchema).join(", ")}`
        );
        continue;
      }

      const colType = dbSchema[schemaKey].type;
      properties[schemaKey] = buildNotionProperty(colType, inputValue);
      if (colType === "title") titleWasSet = true;

      console.log(
        `[Notion] Set "${schemaKey}" (${colType}) = "${inputValue}"`
      );
    }

    // Step 3: Ensure the title property is always set
    if (!titleWasSet) {
      const titleKey = Object.keys(dbSchema).find(
        (k) => dbSchema[k].type === "title"
      );
      if (titleKey) {
        const titleVal =
          inputProps["Name"] ??
          inputProps["name"] ??
          inputProps["Title"] ??
          inputProps["title"] ??
          "Untitled";
        properties[titleKey] = buildNotionProperty("title", titleVal);
        console.log(
          `[Notion] Auto-set title "${titleKey}" = "${titleVal}"`
        );
      }
    }

    console.log(
      "[Notion] Creating page with properties:",
      JSON.stringify(properties, null, 2)
    );

    // Step 4: Build content blocks
    const children = input.content ? textToBlocks(String(input.content)) : [];

    // Step 5: Create the page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: properties as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: children as any,
      ...(input.icon
        ? {
            icon: {
              type: "emoji" as const,
              emoji: String(input.icon) as "🎯",
            },
          }
        : {}),
    });

    const pageId = response.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageUrl = (response as any).url ?? null;

    console.log("[Notion] Page created successfully:", pageId);

    return {
      success: true,
      result: JSON.stringify({
        summary: "Page created successfully",
        page_id: pageId,
        url: pageUrl,
        created: true,
        title:
          inputProps["Name"] ?? inputProps["name"] ?? "Untitled",
      }),
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[Notion] createPage error:", message);
    return {
      success: false,
      error: message,
      fallback: JSON.stringify({
        summary: "Notion create failed",
        page_id: null,
        created: false,
        error: message,
      }),
    };
  }
}

// ── Read Pages ────────────────────────────────────────────────────────────────

export async function notionReadPages(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  if (!isNotionConfigured()) {
    return notionFallback("readPages", { pages: [], total: 0 });
  }

  try {
    const databaseId = formatNotionId(String(input.database_id));

    // Build filter if provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filter: any = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = input.filter as any;

    if (f?.property && f?.value) {
      const filterType = f.type ?? "rich_text";
      switch (filterType) {
        case "title":
          filter = { property: f.property, title: { contains: f.value } };
          break;
        case "select":
          filter = { property: f.property, select: { equals: f.value } };
          break;
        case "status":
          filter = { property: f.property, status: { equals: f.value } };
          break;
        case "multi_select":
          filter = {
            property: f.property,
            multi_select: { contains: f.value },
          };
          break;
        case "checkbox":
          filter = {
            property: f.property,
            checkbox: { equals: f.value === "true" },
          };
          break;
        case "number":
          filter = {
            property: f.property,
            number: { equals: Number(f.value) },
          };
          break;
        default:
          filter = { property: f.property, rich_text: { contains: f.value } };
          break;
      }
    }

    // Use direct REST API for database query
    const queryBody: Record<string, unknown> = {
      page_size: Math.min(Number(input.limit ?? 10), 50),
    };
    if (filter) queryBody.filter = filter;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = (await notionFetch(`/databases/${databaseId}/query`, {
      method: "POST",
      body: queryBody,
    })) as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = (response.results as any[]).map((page: any) => {
      const props: Record<string, string> = {};
      let title = "";

      for (const [key, val] of Object.entries(page.properties ?? {})) {
        const value = extractPropertyValue(val);
        props[key] = value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((val as any).type === "title") title = value;
      }

      return {
        id: page.id,
        url: page.url,
        title,
        properties: props,
        last_edited: page.last_edited_time,
      };
    });

    const summaryLines = pages
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any, i: number) => {
        const propStr = Object.entries(p.properties)
          .filter(([, v]) => v)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ");
        return `${i + 1}. ${p.title || "Untitled"}${propStr ? ` — ${propStr}` : ""}\n   URL: ${p.url} | ID: ${p.id}`;
      })
      .join("\n");

    return {
      success: true,
      result: JSON.stringify({
        summary: `Found ${pages.length} pages in database:\n${summaryLines}`,
        pages,
        total: pages.length,
      }),
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[Notion] readPages error:", message);
    return {
      success: false,
      error: message,
      fallback: JSON.stringify({
        pages: [],
        total: 0,
        error: message,
      }),
    };
  }
}

// ── Update Page ───────────────────────────────────────────────────────────────

export async function notionUpdatePage(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  if (!isNotionConfigured()) {
    return notionFallback("updatePage", {});
  }

  try {
    const notion = getNotionClient();
    const pageId = formatNotionId(String(input.page_id));
    const inputProps = (input.properties ?? {}) as Record<string, unknown>;

    // Get the page to find its parent database for schema lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (await notion.pages.retrieve({ page_id: pageId })) as any;
    const databaseId = page.parent?.database_id;

    let properties: Record<string, unknown> = {};

    if (databaseId) {
      // Use direct REST API — SDK drops properties field
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const database = (await notionFetch(`/databases/${databaseId}`)) as any;
      const dbSchema = database.properties as Record<
        string,
        { type: string }
      >;

      for (const [key, value] of Object.entries(inputProps)) {
        const schemaKey =
          Object.keys(dbSchema).find((k) => k === key) ??
          Object.keys(dbSchema).find(
            (k) => k.toLowerCase() === key.toLowerCase()
          );
        if (!schemaKey) continue;
        properties[schemaKey] = buildNotionProperty(
          dbSchema[schemaKey].type,
          value
        );
      }
    }

    await notion.pages.update({
      page_id: pageId,
      archived: Boolean(input.archived ?? false),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: properties as any,
    });

    return {
      success: true,
      result: `Page ${pageId} updated successfully`,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[Notion] updatePage error:", message);
    return {
      success: false,
      error: message,
      fallback: `Update simulation for ${input.page_id}`,
    };
  }
}

// ── Append Content ────────────────────────────────────────────────────────────

export async function notionAppendContent(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  if (!isNotionConfigured()) {
    return notionFallback("appendContent", {});
  }

  const rawPageId = String(input.page_id ?? "");

  // Guard against null, empty, or stringified-null page IDs
  if (!rawPageId || rawPageId === "null" || rawPageId === "undefined") {
    return {
      success: false,
      error:
        "page_id is missing or null. The page must be created before " +
        "content can be appended.",
      fallback: "Append skipped: no valid page_id",
    };
  }

  const pageId = formatNotionId(rawPageId);

  try {
    const notion = getNotionClient();

    const blocks = [
      ...(input.add_divider
        ? [{ object: "block" as const, type: "divider" as const, divider: {} }]
        : []),
      ...textToBlocks(String(input.content ?? "")),
    ];

    // Batch into groups of 100 (Notion API limit)
    for (let i = 0; i < blocks.length; i += 100) {
      await notion.blocks.children.append({
        block_id: pageId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: blocks.slice(i, i + 100) as any,
      });
    }

    return {
      success: true,
      result: `Appended ${blocks.length} blocks to page ${pageId}`,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[Notion] appendContent error:", message);
    return {
      success: false,
      error: message,
      fallback: `Append simulation for ${input.page_id}`,
    };
  }
}

// ── Create Standalone Page ────────────────────────────────────────────────────

export async function notionCreateStandalonePage(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  if (!isNotionConfigured()) {
    return notionFallback("createStandalonePage", {});
  }

  try {
    const notion = getNotionClient();
    const children = input.content
      ? textToBlocks(String(input.content))
      : [];

    const response = await notion.pages.create({
      parent: { page_id: formatNotionId(String(input.parent_page_id)) },
      properties: {
        title: { title: toRichText(String(input.title)) },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: children as any,
      ...(input.icon
        ? {
            icon: {
              type: "emoji" as const,
              emoji: String(input.icon) as "🎯",
            },
          }
        : {}),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = response as any;

    return {
      success: true,
      result: JSON.stringify({
        summary: `Page "${input.title}" created`,
        page_id: page.id,
        url: page.url,
      }),
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
      fallback: "Page creation simulation",
    };
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function notionSearch(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  if (!isNotionConfigured()) {
    return notionFallback("search", {
      results: [],
      total: 0,
      found: false,
    });
  }

  try {
    const notion = getNotionClient();
    const query = String(input.query ?? "");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams: any = {
      query,
      page_size: Math.min(Number(input.limit ?? 10), 20),
    };
    if (input.filter_type) {
      searchParams.filter = {
        value: input.filter_type,
        property: "object",
      };
    }
    const response = await notion.search(searchParams);

    const queryLower = query.toLowerCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = response.results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        let title = "Untitled";

        if (item.object === "page") {
          // Find the title property
          const titleProp =
            item.properties?.Name ??
            item.properties?.title ??
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.values(item.properties ?? {}).find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (p: any) => p.type === "title"
            );

          if (titleProp) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            title = fromRichText((titleProp as any).title ?? []) || "Untitled";
          }
        } else if (item.object === "database") {
          title = fromRichText(item.title ?? []) || "Untitled Database";
        }

        const titleLower = title.toLowerCase();

        return {
          id: item.id,
          title,
          url: item.url,
          object: item.object,
          exact_match: titleLower === queryLower,
          partial_match:
            titleLower.includes(queryLower) ||
            queryLower.includes(titleLower),
        };
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.exact_match || r.partial_match);

    return {
      success: true,
      result: JSON.stringify({
        summary:
          results.length > 0
            ? `Found ${results.length} result(s) for "${query}"`
            : `No results found for "${query}"`,
        results,
        total: results.length,
        query,
        found: results.length > 0,
        best_match:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results.find((r: any) => r.exact_match) ?? results[0] ?? null,
      }),
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[Notion] search error:", message);
    return {
      success: false,
      error: message,
      fallback: JSON.stringify({
        results: [],
        total: 0,
        found: false,
        error: message,
      }),
    };
  }
}

// ── Check Page Exists ─────────────────────────────────────────────────────────

export async function notionCheckPageExists(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  if (!isNotionConfigured()) {
    return {
      success: true,
      result: JSON.stringify({
        exists: false,
        found: false,
        page_id: null,
      }),
    };
  }

  try {
    // Use direct REST API for database query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = (await notionFetch(
      `/databases/${formatNotionId(String(input.database_id))}/query`,
      {
        method: "POST",
        body: {
          filter: {
            property: String(input.title_property ?? "Name"),
            title: {
              equals: String(input.contact_name),
            },
          },
          page_size: 1,
        },
      }
    )) as any;

    const exists = response.results.length > 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = exists ? (response.results[0] as any) : null;

    return {
      success: true,
      result: JSON.stringify({
        exists,
        found: exists,
        page_id: page?.id ?? null,
        contact_name: input.contact_name,
        message: exists
          ? `Found page for "${input.contact_name}"`
          : `No page for "${input.contact_name}"`,
      }),
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    // Surface permission errors clearly
    if (
      message.includes("Could not find database") ||
      message.includes("Make sure the relevant pages")
    ) {
      return {
        success: false,
        error: message,
        fallback: JSON.stringify({
          exists: false,
          found: false,
          page_id: null,
          error:
            "Database not accessible. Share it with the Agent Foundry integration in Notion.",
        }),
      };
    }

    return {
      success: false,
      error: message,
      fallback: JSON.stringify({
        exists: false,
        found: false,
        page_id: null,
      }),
    };
  }
}
