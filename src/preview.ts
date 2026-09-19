import type { FontCategory, GoogleFont } from "./fonts.js";

const CSS_API_URL = "https://fonts.googleapis.com/css2";

export const DEFAULT_PREVIEW_TEXT = "The quick brown fox jumps over the lazy dog";

const FALLBACK_STACKS: Record<FontCategory, string> = {
  serif: "Georgia, 'Times New Roman', Times, serif",
  "sans-serif": "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  display: "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  handwriting: "'Comic Sans MS', 'Segoe Script', cursive",
  monospace: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace",
};

export interface PreviewOptions {
  font: GoogleFont;
  text: string;
  /** Font size in pixels. */
  size: number;
  weight: number;
  italic: boolean;
  /** Any CSS colour accepted by {@link isValidColour}. */
  colour: string;
}

/**
 * Returns the API variant key for a weight/style pair, e.g. 400 → "regular",
 * 400 italic → "italic", 700 italic → "700italic".
 */
export function variantKey(weight: number, italic: boolean): string {
  if (weight === 400) return italic ? "italic" : "regular";
  return italic ? `${weight}italic` : String(weight);
}

/** Formats an API variant key for people, e.g. "700italic" → "700 italic". */
export function describeVariant(variant: string): string {
  if (variant === "regular") return "400";
  if (variant === "italic") return "400 italic";
  return variant.replace("italic", " italic");
}

/** Returns the CSS fallback font stack for a Google Fonts category. */
export function getFallbackStack(category: FontCategory): string {
  return FALLBACK_STACKS[category] ?? "sans-serif";
}

/** Returns a full CSS font-family value, e.g. `'Open Sans', system-ui, ..., sans-serif`. */
export function fontFamilyValue(font: GoogleFont): string {
  return `'${font.family.replace(/['\\]/g, "\\$&")}', ${getFallbackStack(font.category)}`;
}

/**
 * Builds a Google Fonts CSS2 stylesheet URL for the given family and styles.
 *
 * @param family - Family name, e.g. "Open Sans".
 * @param styles - Weight/style pairs to load. Omit to load the default regular style.
 * @returns e.g. `https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;1,700&display=swap`
 */
export function buildStylesheetUrl(
  family: string,
  styles: { weight: number; italic: boolean }[] = [],
): string {
  // The CSS2 API wants spaces as "+"; everything else is percent-encoded.
  let familyParam = encodeURIComponent(family).replace(/%20/g, "+");

  const isDefaultOnly =
    styles.length === 0 ||
    styles.every((s) => s.weight === 400 && !s.italic);

  if (!isDefaultOnly) {
    // Tuples must be unique and sorted, italic-off before italic-on.
    const unique = [...new Map(styles.map((s) => [`${+s.italic},${s.weight}`, s])).values()]
      .sort((a, b) => +a.italic - +b.italic || a.weight - b.weight);

    familyParam += unique.some((s) => s.italic)
      ? `:ital,wght@${unique.map((s) => `${+s.italic},${s.weight}`).join(";")}`
      : `:wght@${unique.map((s) => s.weight).join(";")}`;
  }

  return `${CSS_API_URL}?family=${familyParam}&display=swap`;
}

/**
 * Checks that a colour is a safe CSS colour value: a hex colour, a named
 * colour, or an rgb()/rgba()/hsl()/hsla() function. Rejects anything that
 * could break out of a style attribute.
 */
export function isValidColour(colour: string): boolean {
  return (
    /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(colour) ||
    /^[a-z]+$/i.test(colour) ||
    /^(?:rgba?|hsla?)\(\s*[\d.,%\s/deg]+\)$/i.test(colour)
  );
}

/** Escapes text for safe use in HTML content and double-quoted attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds a self-contained HTML page that renders sample text in a Google Font.
 *
 * The page loads only the requested style from the Google Fonts CSS API and
 * uses inline styles for everything else. The sample text is HTML-escaped.
 *
 * @throws If the colour is not a valid CSS colour (see {@link isValidColour}).
 */
export function buildPreview({
  font,
  text,
  size,
  weight,
  italic,
  colour,
}: PreviewOptions): string {
  if (!isValidColour(colour)) {
    throw new Error(`Invalid colour: ${colour}`);
  }

  const href = buildStylesheetUrl(font.family, [{ weight, italic }]);
  const style = [
    `font-family: ${fontFamilyValue(font)}`,
    `font-size: ${size}px`,
    `font-weight: ${weight}`,
    `font-style: ${italic ? "italic" : "normal"}`,
    `color: ${colour}`,
    "line-height: 1.3",
    "margin: 0",
    "padding: 24px",
    "white-space: pre-wrap",
    "overflow-wrap: anywhere",
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(font.family)} preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${escapeHtml(href)}">
</head>
<body style="margin: 0;">
<p style="${escapeHtml(style)}">${escapeHtml(text)}</p>
</body>
</html>`;
}
