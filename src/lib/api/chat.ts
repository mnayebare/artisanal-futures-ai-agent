// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Chat API Service
// Place at: src/lib/api/chat.ts
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:      "user" | "agent";
  text:      string;
  metadata?: {
    trends?:    unknown[];
    reasoning?: string;
    platform?:  string;
  };
}

export interface Product {
  id:       string;
  name:     string;
  category: string;
  price:    number;
  inStock:  boolean;
  imageUrl?: string;
}

export interface ChatRequest {
  message:      string;
  history:      ChatMessage[];
  platform?:    string;
  image_base64?: string;
}

export interface ChatResponse {
  reply:            string;
  products?:        Product[];
  trends?:          TrendResult[];
  suggested_title?: string;
  reasoning?:       string;
  best_platform?:   "google" | "reddit" | "either";
  intent_data?: {
    intent:        string;
    keyword:       string;
    subreddit:     string;
    best_platform: string;
    reason:        string;
  };
  reddit_posts?:    {
    title:     string;
    url:       string;
    comments:  number;
    score:     number;
    subreddit: string;
  }[];
}

export interface RelatedQuery {
  query: string;
  value: number;
}

export interface TrendResult {
  keyword:       string;
  is_trending:   boolean;
  weekly_counts: number[];
  dates?:        string[];       // matching dates for spark bar labels
  prediction?:   string;
  rising?:       RelatedQuery[]; // fast-growing related searches
  top?:          RelatedQuery[]; // highest volume related searches
  demographics?: {
    ages:    Record<string, string>;
    genders: Record<string, string>;
  };
}

// ─── Send chat message ────────────────────────────────────────────────────────

export async function sendChatMessage(
  payload: ChatRequest
): Promise<ChatResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[chat] API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as ChatResponse;
    return data;
  } catch (err) {
    console.error("[chat] sendChatMessage failed:", err);
    return null;
  }
}