const API_URL = "https://www.googleapis.com/webfonts/v1/webfonts";

export const FONT_CATEGORIES = [
  "serif",
  "sans-serif",
  "display",
  "handwriting",
  "monospace",
] as const;

export type FontCategory = (typeof FONT_CATEGORIES)[number];

/** A font family as returned by the Google Fonts Web Fonts Developer API. */
export interface GoogleFont {
  family: string;
  category: FontCategory;
  variants: string[];
  subsets: string[];
  version: string;
  lastModified: string;
  /** Maps each variant (e.g. "regular", "700italic") to its font file URL. */
  files: Record<string, string>;
}

interface WebfontsResponse {
  kind: string;
  items: GoogleFont[];
}

let fontCache: GoogleFont[] = [];
let pendingLoad: Promise<GoogleFont[]> | null = null;

/**
 * Returns every Google Font family, sorted by popularity.
 *
 * Fetches from the API on first call and serves the cached list after that.
 * Concurrent first calls share a single request. A failed request is not
 * cached, so the next call retries.
 *
 * @throws If GOOGLE_FONTS_API_KEY is not set or the API request fails.
 */
export async function loadFonts(): Promise<GoogleFont[]> {
  if (fontCache.length > 0) return fontCache;
  if (pendingLoad) return pendingLoad;

  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_FONTS_API_KEY is not set. Add it to your .env file or environment (see .env.example).",
    );
  }

  pendingLoad = (async () => {
    const url = new URL(API_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("sort", "popularity");

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Google Fonts API request failed: ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 300)}` : ""}`,
      );
    }

    const data = (await response.json()) as WebfontsResponse;
    fontCache = data.items ?? [];
    console.error(`Loaded ${fontCache.length} font families from Google Fonts`);
    return fontCache;
  })();

  try {
    return await pendingLoad;
  } finally {
    pendingLoad = null;
  }
}

/**
 * Searches font families by name and/or category, keeping popularity order.
 *
 * @param query - Case-insensitive substring to match against the family name.
 * @param category - Only include families in this category.
 * @param limit - Maximum number of results to return.
 * @returns Matching families, most popular first.
 */
export async function searchFonts(
  query: string | undefined,
  category: FontCategory | undefined,
  limit: number,
): Promise<GoogleFont[]> {
  const fonts = await loadFonts();
  const needle = query?.trim().toLowerCase();

  return fonts
    .filter(
      (font) =>
        (!needle || font.family.toLowerCase().includes(needle)) &&
        (!category || font.category === category),
    )
    .slice(0, limit);
}

/**
 * Looks up a single family by exact name, ignoring case.
 *
 * @param family - The family name, e.g. "Open Sans".
 * @returns The matching family, or undefined if there is none.
 */
export async function getFont(family: string): Promise<GoogleFont | undefined> {
  const fonts = await loadFonts();
  const target = family.trim().toLowerCase();
  return fonts.find((font) => font.family.toLowerCase() === target);
}

/**
 * Suggests family names that are close to the given (misspelled or partial) name.
 *
 * Families containing the name, or contained by it, rank first. The rest are
 * ranked by edit distance, and only reasonably close ones are kept.
 *
 * @param family - The name that failed an exact lookup.
 * @param limit - Maximum number of suggestions to return.
 * @returns Suggested family names, best match first.
 */
export async function findClosestFonts(
  family: string,
  limit = 5,
): Promise<string[]> {
  const fonts = await loadFonts();
  const target = family.trim().toLowerCase();
  if (!target) return [];

  const maxDistance = Math.max(2, Math.floor(target.length / 3));

  return fonts
    .map((font, popularityRank) => {
      const name = font.family.toLowerCase();
      const isSubstring = name.includes(target) || target.includes(name);
      const distance = isSubstring ? 0 : levenshtein(target, name);
      return { family: font.family, distance, popularityRank };
    })
    .filter((match) => match.distance <= maxDistance)
    .sort(
      (a, b) => a.distance - b.distance || a.popularityRank - b.popularityRank,
    )
    .slice(0, limit)
    .map((match) => match.family);
}

/**
 * Returns the distinct numeric weights a family offers, e.g. [300, 400, 700].
 * "regular" and "italic" both count as 400.
 */
export function getWeights(font: GoogleFont): number[] {
  const weights = new Set<number>();
  for (const variant of font.variants) {
    const match = /^(\d+)/.exec(variant);
    weights.add(match ? Number(match[1]) : 400);
  }
  return [...weights].sort((a, b) => a - b);
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }
  return previous[b.length];
}
