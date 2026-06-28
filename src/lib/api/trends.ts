// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Trend Types & Helpers
// Place at: src/lib/api/trends.ts
// ─────────────────────────────────────────────────────────────────────────────

// ─── Platform selection ───────────────────────────────────────────────────────

export type TrendPlatform = "google" | "pinterest" | "reddit";

export interface PlatformOption {
  id:          TrendPlatform;
  label:       string;
  description: string;
  available:   boolean;
}

export const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    id:          "google",
    label:       "Google Trends",
    description: "Search interest over time, regional data & rising queries",
    available:   true,
  },
  {
    id:          "reddit",
    label:       "Reddit",
    description: "Real opinions from fashion communities on similar products",
    available:   true,
  },
  {
    id:          "pinterest",
    label:       "Pinterest Trends",
    description: "Save intent, demographics & visual trend data",
    available:   false,
  },
];

// Keywords that trigger the platform selector
const PLATFORM_TRIGGER_WORDS = [
  "trend", "trends", "trending",
  "sales", "selling", "sell",
  "marketing", "market",
  "popular", "popularity",
  "what's hot", "in style", "in fashion",
  "people buying", "people wearing",
  "hot right now", "what's in",
];

export function needsPlatformSelection(text: string): boolean {
  const lower = text.toLowerCase();
  return PLATFORM_TRIGGER_WORDS.some((k) => lower.includes(k));
}

// ─── Trend detection ──────────────────────────────────────────────────────────

const TREND_TRIGGER_WORDS = [
  "trend", "trending", "popular", "what's hot", "in style",
  "in fashion", "pinterest", "what's popular", "selling",
  "people buying", "people wearing", "hot right now",
];

export function isTrendQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return TREND_TRIGGER_WORDS.some((k) => lower.includes(k));
}

// ─── Keyword extraction ───────────────────────────────────────────────────────

// Words to strip before extracting the core fashion term
const NOISE_WORDS = [
  // Question starters
  "what's", "what is", "what are", "whats", "is", "are", "how",
  // Trend-related verbs and phrases
  "trending", "popular", "hot", "in style", "in fashion",
  "people buying", "people wearing", "selling", "selling well",
  "most popular", "most trending",
  // Location/time context
  "on pinterest", "on instagram", "right now", "at the moment",
  "this season", "this summer", "this year", "this month",
  "for summer", "for spring", "for fall", "for winter",
  // Prepositions and articles
  "in", "the", "a", "an", "for", "with", "and", "or",
];

// Common plural → singular mappings for fashion terms
const PLURALS: Record<string, string> = {
  dresses:     "dress",
  jumpsuits:   "jumpsuit",
  rompers:     "romper",
  skirts:      "skirt",
  tops:        "top",
  blouses:     "blouse",
  bags:        "bag",
  purses:      "purse",
  clutches:    "clutch",
  sandals:     "sandal",
  heels:       "heel",
  sneakers:    "sneaker",
  earrings:    "earring",
  necklaces:   "necklace",
  bracelets:   "bracelet",
  rings:       "ring",
  perfumes:    "perfume",
  sets:        "set",
  outfits:     "outfit",
  looks:       "look",
  styles:      "style",
  trends:      "trend",
  colors:      "color",
  patterns:    "pattern",
  prints:      "print",
};

// Fashion category synonyms → normalized Pinterest-friendly terms
const SYNONYMS: Record<string, string> = {
  "going out outfit":    "night out dress",
  "going out dress":     "night out dress",
  "party dress":         "cocktail dress",
  "date outfit":         "date night dress",
  "beach outfit":        "beach dress",
  "vacation outfit":     "resort wear",
  "summer look":         "summer dress",
  "festival outfit":     "festival fashion",
  "work outfit":         "office dress",
  "office look":         "office dress",
  "crossbody":           "crossbody bag",
  "tote":                "tote bag",
  "clutch bag":          "clutch",
  "mini":                "mini dress",
  "midi":                "midi dress",
  "maxi":                "maxi dress",
};

function normalizePlurals(text: string): string {
  return text
    .split(" ")
    .map((word) => PLURALS[word.toLowerCase()] ?? word)
    .join(" ");
}

function applySynonyms(text: string): string {
  const lower = text.toLowerCase();
  for (const [phrase, replacement] of Object.entries(SYNONYMS)) {
    if (lower.includes(phrase)) {
      return lower.replace(phrase, replacement);
    }
  }
  return text;
}

function stripNoiseWords(text: string): string {
  let result = text.toLowerCase();
  // Sort by length descending so longer phrases are stripped first
  const sorted = [...NOISE_WORDS].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  }
  // Clean up extra spaces and punctuation
  return result
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a clean Pinterest-ready keyword from a user's natural language query.
 *
 * Examples:
 *   "what's trending in mesh mini dresses right now?" → "mesh mini dress"
 *   "what are people wearing this summer?"            → "summer dress"
 *   "is the crossbody bag popular on pinterest?"      → "crossbody bag"
 *   "what's hot for going out outfits?"               → "night out dress"
 */
export function extractKeyword(text: string): string {
  // Step 1 — apply synonym mapping first (before stripping words)
  let result = applySynonyms(text);

  // Step 2 — strip noise words
  result = stripNoiseWords(result);

  // Step 3 — normalize plurals
  result = normalizePlurals(result);

  // Step 4 — cap at 4 words (Pinterest performs best with short phrases)
  const words = result.split(" ").filter(Boolean);
  result = words.slice(0, 4).join(" ");

  // Fallback to original trimmed text if extraction produced nothing
  return result || text.trim();
}