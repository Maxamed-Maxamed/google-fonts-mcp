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
  type GoogleFont,
} from "./fonts.js";
import {
  DEFAULT_PREVIEW_TEXT,
  buildPreview,
  buildStylesheetUrl,
  describeVariant,
  fontFamilyValue,
  isValidColour,
  variantKey,
} from "./preview.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_SIZE = 48;
const MIN_SIZE = 8;
const MAX_SIZE = 200;
const DEFAULT_WEIGHT = 400;
const DEFAULT_COLOUR = "#111111";
const DEFAULT_EMBED_WEIGHTS = [400, 700];

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
    {
      name: "preview_text",
      description:
        "Render sample text in a Google Font. Returns a self-contained HTML page. The weight/italic combination must exist in the family.",
      inputSchema: {
        type: "object",
        properties: {
          family: {
            type: "string",
            description: 'Family name, case-insensitive (e.g. "Open Sans")',
          },
          text: {
            type: "string",
            default: DEFAULT_PREVIEW_TEXT,
            description: "Sample text to render",
          },
          size: {
            type: "number",
            default: DEFAULT_SIZE,
            minimum: MIN_SIZE,
            maximum: MAX_SIZE,
            description: `Font size in pixels (${MIN_SIZE}-${MAX_SIZE})`,
          },
          weight: {
            type: "number",
            default: DEFAULT_WEIGHT,
            description: "Font weight, e.g. 400 or 700",
          },
          italic: {
            type: "boolean",
            default: false,
            description: "Render in italic",
          },
          colour: {
            type: "string",
            default: DEFAULT_COLOUR,
            description: 'Text colour: hex (e.g. "#1a1a1a"), a CSS colour name, or rgb()/hsl()',
          },
        },
        required: ["family"],
      },
    },
    {
      name: "get_embed_code",
      description:
        "Get the HTML link tags and CSS font-family declaration to use a Google Font on a web page.",
      inputSchema: {
        type: "object",
        properties: {
          family: {
            type: "string",
            description: 'Family name, case-insensitive (e.g. "Open Sans")',
          },
          weights: {
            type: "array",
            items: { type: "number" },
            default: DEFAULT_EMBED_WEIGHTS,
            description: "Upright weights to load, e.g. [400, 700]",
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
      case "preview_text":
        return await handlePreviewText(args);
      case "get_embed_code":
        return await handleGetEmbedCode(args);
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
    return textResult(await notFoundMessage(family));
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

async function handlePreviewText(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const {
    family,
    text = DEFAULT_PREVIEW_TEXT,
    size = DEFAULT_SIZE,
    weight = DEFAULT_WEIGHT,
    italic = false,
    colour = DEFAULT_COLOUR,
  } = args;

  if (typeof family !== "string" || !family.trim()) {
    return errorResult("family is required and must be a non-empty string.");
  }
  if (typeof text !== "string" || !text) {
    return errorResult("text must be a non-empty string.");
  }
  if (typeof size !== "number" || !(size >= MIN_SIZE && size <= MAX_SIZE)) {
    return errorResult(`size must be a number from ${MIN_SIZE} to ${MAX_SIZE}.`);
  }
  if (typeof weight !== "number" || !Number.isInteger(weight)) {
    return errorResult("weight must be an integer, e.g. 400 or 700.");
  }
  if (typeof italic !== "boolean") {
    return errorResult("italic must be true or false.");
  }
  if (typeof colour !== "string" || !isValidColour(colour.trim())) {
    return errorResult(
      'colour must be a hex colour (e.g. "#1a1a1a"), a CSS colour name, or an rgb()/hsl() value.',
    );
  }

  const font = await getFont(family);
  if (!font) {
    return errorResult(await notFoundMessage(family));
  }

  const variant = variantKey(weight, italic);
  if (!font.variants.includes(variant)) {
    return errorResult(
      `${font.family} is not available in ${describeVariant(variant)}.\n\nAvailable variants: ${formatVariants(font)}`,
    );
  }

  const html = buildPreview({
    font,
    text,
    size,
    weight,
    italic,
    colour: colour.trim(),
  });

  return {
    content: [
      {
        type: "text",
        text: `Preview of ${font.family} (${font.category}) at ${size}px, weight ${describeVariant(variant)}, colour ${colour.trim()}.`,
      },
      { type: "text", text: html },
    ],
  };
}

async function handleGetEmbedCode(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { family, weights = DEFAULT_EMBED_WEIGHTS } = args;

  if (typeof family !== "string" || !family.trim()) {
    return errorResult("family is required and must be a non-empty string.");
  }
  if (
    !Array.isArray(weights) ||
    weights.length === 0 ||
    !weights.every((w) => typeof w === "number" && Number.isInteger(w))
  ) {
    return errorResult("weights must be a non-empty array of integers, e.g. [400, 700].");
  }

  const font = await getFont(family);
  if (!font) {
    return errorResult(await notFoundMessage(family));
  }

  const requested = [...new Set(weights as number[])].sort((a, b) => a - b);
  const missing = requested.filter(
    (w) => !font.variants.includes(variantKey(w, false)),
  );
  if (missing.length > 0) {
    const available = font.variants
      .filter((v) => !v.endsWith("italic"))
      .map(describeVariant);
    return errorResult(
      `${font.family} does not have weight${missing.length === 1 ? "" : "s"} ${missing.join(", ")}.\n\nAvailable weights: ${available.join(", ")}`,
    );
  }

  // Family names are percent-encoded, so the URL is safe in a quoted attribute
  // as-is. Keep the plain "&" so the snippet matches what Google Fonts gives out.
  const href = buildStylesheetUrl(
    font.family,
    requested.map((weight) => ({ weight, italic: false })),
  );

  return textResult(
    [
      `Embed code for ${font.family} (weights ${requested.join(", ")}):`,
      "",
      "HTML (place in <head>):",
      "",
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      `<link href="${href}" rel="stylesheet">`,
      "",
      "CSS:",
      "",
      `font-family: ${fontFamilyValue(font)};`,
    ].join("\n"),
  );
}

async function notFoundMessage(family: string): Promise<string> {
  const suggestions = await findClosestFonts(family);
  const hint =
    suggestions.length > 0
      ? `Did you mean:\n${suggestions.map((s) => `- ${s}`).join("\n")}`
      : "Try search_fonts to find the family you're looking for.";
  return `No font family named "${family.trim()}" was found.\n\n${hint}`;
}

function formatVariants(font: GoogleFont): string {
  return font.variants.map(describeVariant).join(", ");
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
