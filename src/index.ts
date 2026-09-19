#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "google-fonts-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  throw new Error(`Unknown tool: ${request.params.name}`);
});

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
