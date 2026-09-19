#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  FONT_CATEGORIES,
  findClosestFonts,
  getFont,
  getWeights,
  searchFonts,
  type FontCategory,
} from "./fonts.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const server = new Server(
  { name: "google-fonts-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_fonts",
      description:
        "Search Google Fonts by family name and/or category. Results are sorted by popularity. Provide at least one of query or category.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Case-insensitive text to match in the family name",
          },
          category: {
            type: "string",
            enum: [...FONT_CATEGORIES],
            description: "Only return fonts in this category",
          },
          limit: {
            type: "number",
            default: DEFAULT_LIMIT,
            minimum: 1,
            maximum: MAX_LIMIT,
            description: `Maximum number of results (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`,
          },
        },
      },
    },
    {
      name: "get_font_details",
      description:
        "Get full metadata for a Google Fonts family: category, variants, subsets, version and last modified date.",
      inputSchema: {
        type: "object",
        properties: {
          family: {
            type: "string",
            description: 'Exact family name, case-insensitive (e.g. "Open Sans")',
          },
        },
        required: ["family"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "search_fonts":
        return await handleSearchFonts(args);
      case "get_font_details":
        return await handleGetFontDetails(args);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Tool ${name} failed:`, message);
    return errorResult(message);
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function handleSearchFonts(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { query, category, limit = DEFAULT_LIMIT } = args;

  if (query !== undefined && typeof query !== "string") {
    return errorResult("query must be a string.");
  }
  if (category !== undefined && !isFontCategory(category)) {
    return errorResult(
      `category must be one of: ${FONT_CATEGORIES.join(", ")}.`,
    );
  }
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
    return errorResult("limit must be a positive integer.");
  }
  if (!query?.trim() && !category) {
    return errorResult("Provide at least one of query or category.");
  }

  const results = await searchFonts(query, category, Math.min(limit, MAX_LIMIT));

  const criteria = [
    query?.trim() && `query "${query.trim()}"`,
    category && `category ${category}`,
  ]
    .filter(Boolean)
    .join(" and ");

  if (results.length === 0) {
    return textResult(`No fonts found matching ${criteria}.`);
  }

  const lines = results.map(
    (font, i) =>
      `${i + 1}. ${font.family} (${font.category}) - weights: ${getWeights(font).join(", ")}`,
  );
  return textResult(
    `Found ${results.length} font${results.length === 1 ? "" : "s"} matching ${criteria}:\n\n${lines.join("\n")}`,
  );
}

async function handleGetFontDetails(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { family } = args;
  if (typeof family !== "string" || !family.trim()) {
    return errorResult("family is required and must be a non-empty string.");
  }

  const font = await getFont(family);
  if (!font) {
    const suggestions = await findClosestFonts(family);
    const hint =
      suggestions.length > 0
        ? `Did you mean:\n${suggestions.map((s) => `- ${s}`).join("\n")}`
        : "Try search_fonts to find the family you're looking for.";
    return textResult(`No font family named "${family.trim()}" was found.\n\n${hint}`);
  }

  return textResult(
    [
      `# ${font.family}`,
      "",
      `Category: ${font.category}`,
      `Weights: ${getWeights(font).join(", ")}`,
      `Variants (${font.variants.length}): ${font.variants.join(", ")}`,
      `Subsets (${font.subsets.length}): ${font.subsets.join(", ")}`,
      `Version: ${font.version}`,
      `Last modified: ${font.lastModified}`,
    ].join("\n"),
  );
}

function isFontCategory(value: unknown): value is FontCategory {
  return (FONT_CATEGORIES as readonly unknown[]).includes(value);
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

async function main(): Promise<void> {
  if (!process.env.GOOGLE_FONTS_API_KEY) {
    // stdout is reserved for the MCP protocol, so log to stderr
    console.error("Warning: GOOGLE_FONTS_API_KEY is not set");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("google-fonts-mcp running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
