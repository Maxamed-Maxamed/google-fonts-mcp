# google-fonts-mcp

An MCP server that lets AI assistants search, inspect, preview and embed Google Fonts.

[![npm version](https://img.shields.io/npm/v/google-fonts-mcp.svg)](https://www.npmjs.com/package/google-fonts-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-server-8A2BE2.svg)](https://modelcontextprotocol.io)

## What it does

google-fonts-mcp connects Claude Desktop (or any MCP client) to the Google Fonts Web Fonts Developer API. It loads the full font catalogue once, sorted by popularity, caches it in memory, and answers from the cache after that. If you misspell a family name, it suggests the closest matches.

- **`search_fonts`**: find families by name and/or category, most popular first.
- **`get_font_details`**: get a family's category, weights, variants, subsets, version and last-modified date.
- **`preview_text`**: render sample text in a font as a self-contained HTML page.
- **`get_embed_code`**: get the `<link>` tags and CSS `font-family` declaration for a web page.

## Examples

**"Find me some popular monospace fonts."**

Calls `search_fonts` with `category: "monospace"` and returns a numbered list:

```
Found 10 fonts matching category monospace:

1. Roboto Mono (monospace) - weights: 100, 200, 300, 400, 500, 600, 700
2. Source Code Pro (monospace) - weights: 200, 300, 400, 500, 600, 700, 800, 900
3. JetBrains Mono (monospace) - weights: 100, 200, 300, 400, 500, 600, 700, 800
...
```

**"Show me 'Hello, world' in Playfair Display, bold italic, at 64px."**

Calls `preview_text` with `family: "Playfair Display"`, `text: "Hello, world"`, `size: 64`, `weight: 700`, `italic: true`. Returns a one-line summary plus a self-contained HTML page that loads just that style:

```
Preview of Playfair Display (serif) at 64px, weight 700 italic, colour #111111.
```

If the family doesn't have that weight and style, you get the list of variants it does have.

**"How do I add Inter at 400 and 600 to my site?"**

Calls `get_embed_code` with `family: "Inter"`, `weights: [400, 600]`:

```
Embed code for Inter (weights 400, 600):

HTML (place in <head>):

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&amp;display=swap" rel="stylesheet">

CSS:

font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
```

Results come from the live Google Fonts catalogue, so exact lists and weights may differ.

## Installation

### npx (recommended)

No install step. Your MCP client runs the server on demand:

```bash
npx -y google-fonts-mcp
```

Requires Node.js 18 or later. See [Configuration](#configuration) for the Claude Desktop setup.

### From source

```bash
git clone https://github.com/Maxamed-Maxamed/google-fonts-mcp.git
cd google-fonts-mcp
npm install
npm run build
```

The built server is `dist/index.js`.

## Getting a Google Fonts API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. Create a project, or select an existing one, from the project picker in the top bar.
3. Open **APIs & Services → Library**, search for **Web Fonts Developer API**, and click **Enable**.
4. Open **APIs & Services → Credentials**, click **Create credentials → API key**, and copy the key.
5. Optional: click **Edit API key** and, under **API restrictions**, restrict it to the Web Fonts Developer API.

The key is read from the `GOOGLE_FONTS_API_KEY` environment variable. When running from source you can put it in a `.env` file instead:

```bash
cp .env.example .env
# then edit .env and set GOOGLE_FONTS_API_KEY
```

## Configuration

Add the server to your `claude_desktop_config.json`:

| OS | Config file path |
|---|---|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |

### macOS

```json
{
  "mcpServers": {
    "google-fonts": {
      "command": "npx",
      "args": ["-y", "google-fonts-mcp"],
      "env": {
        "GOOGLE_FONTS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Windows

```json
{
  "mcpServers": {
    "google-fonts": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "google-fonts-mcp"],
      "env": {
        "GOOGLE_FONTS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Running a local build

Point `node` at the built file instead of using `npx`:

```json
{
  "mcpServers": {
    "google-fonts": {
      "command": "node",
      "args": ["/absolute/path/to/google-fonts-mcp/dist/index.js"],
      "env": {
        "GOOGLE_FONTS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

On Windows, escape backslashes in the path (`C:\\Users\\you\\google-fonts-mcp\\dist\\index.js`) or use forward slashes.

Restart Claude Desktop after editing the config.

## Tool reference

Family names are matched case-insensitively. If no family matches, the error lists up to five close matches.

### `search_fonts`

Search families by name and/or category. Results are sorted by popularity. Provide at least one of `query` or `category`.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | No | — | Case-insensitive text to match anywhere in the family name |
| `category` | string | No | — | One of `serif`, `sans-serif`, `display`, `handwriting`, `monospace` |
| `limit` | number | No | `10` | Maximum results, integer from 1 to 50. Values above 50 are capped at 50 |

Returns a numbered list of families with their category and available weights.

### `get_font_details`

Get full metadata for one family.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `family` | string | Yes | — | Exact family name, e.g. `"Open Sans"` |

Returns the category, weights, variants, subsets, version and last-modified date.

### `preview_text`

Render sample text in a font. The weight and italic combination must exist in the family.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `family` | string | Yes | — | Family name, e.g. `"Open Sans"` |
| `text` | string | No | `"The quick brown fox jumps over the lazy dog"` | Sample text to render |
| `size` | number | No | `48` | Font size in pixels, 8 to 200 |
| `weight` | number | No | `400` | Font weight as an integer, e.g. `400` or `700` |
| `italic` | boolean | No | `false` | Render in italic |
| `colour` | string | No | `"#111111"` | Hex (`"#1a1a1a"`), a CSS colour name, or `rgb()`/`hsl()` |

Returns a summary line and a self-contained HTML page. The page loads only the requested style from the Google Fonts CSS API, and the sample text is HTML-escaped.

### `get_embed_code`

Get the HTML and CSS needed to use a family on a web page.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `family` | string | Yes | — | Family name, e.g. `"Open Sans"` |
| `weights` | number[] | No | `[400, 700]` | Upright weights to load, as integers. Duplicates are removed |

Returns `preconnect` and stylesheet `<link>` tags plus a `font-family` declaration with a fallback stack that matches the font's category. If any requested weight is missing, the error lists the weights the family has.

## Development

### Project structure

```
google-fonts-mcp/
├── src/
│   ├── index.ts      # MCP server: tool definitions, argument validation, handlers
│   ├── fonts.ts      # Google Fonts API client, caching, search and fuzzy matching
│   └── preview.ts    # Variant helpers, CSS2 URL builder, fallback stacks, HTML preview
├── dist/             # Compiled output (generated by npm run build)
├── .env.example      # Template for GOOGLE_FONTS_API_KEY
├── package.json
└── tsconfig.json
```

### npm scripts

| Script | Command | What it does |
|---|---|---|
| `npm run build` | `tsc` | Compile `src/` to `dist/` |
| `npm run dev` | `tsc --watch` | Recompile on every change |
| `npm start` | `node dist/index.js` | Run the server on stdio |

### Testing

There is no automated test suite yet. Test the tools interactively with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

The server loads `.env` automatically, so set your key there first. In the Inspector, open **Tools**, click **List Tools**, and call each tool with sample arguments.

Things worth checking after a change:

- A misspelled family (e.g. `"Robotto"`) returns suggestions.
- `preview_text` with a weight the family lacks returns the available variants.
- `get_embed_code` with a missing weight returns the available weights.
- Starting without `GOOGLE_FONTS_API_KEY` logs a warning, and tool calls return a clear error.

The server writes logs to stderr because stdout carries the MCP protocol. Don't add `console.log` calls.

## Contributing

1. Fork the repo and create a branch from `main`.
2. Make your change and run `npm run build` to make sure it compiles.
3. Test the affected tools with the MCP Inspector.
4. Open a pull request that describes the change and how you tested it.

Bug reports and feature requests go in [GitHub Issues](https://github.com/Maxamed-Maxamed/google-fonts-mcp/issues).

## License

[MIT](LICENSE) © Maxamed Maxamed
