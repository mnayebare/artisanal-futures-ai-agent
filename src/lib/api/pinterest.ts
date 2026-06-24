// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Pinterest API Service
// Place at: src/lib/api/pinterest.ts
// ─────────────────────────────────────────────────────────────────────────────

import { type TrendResult } from "./chat";
import { extractKeyword } from "./trends";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Top trends ───────────────────────────────────────────────────────────────

export interface TopTrendsParams {
  region?:               string;
  trend_type?:           "weekly" | "monthly" | "yearly";
  limit?:                number;
  include_predictions?:  boolean;
  include_demographics?: boolean;
  genders?:              string;
  ages?:                 string;
}

export interface TopTrendsResponse {
  region:     string;
  trend_type: string;
  filters:    { genders: string | string[]; ages: string | string[] };
  total:      number;
  trends:     TrendResult[];
}

export async function fetchTopTrends(
  params: TopTrendsParams = {}
): Promise<TopTrendsResponse | null> {
  try {
    const query = new URLSearchParams({
      region:               params.region               ?? "US",
      trend_type:           params.trend_type           ?? "monthly",
      limit:                String(params.limit         ?? 20),
      include_predictions:  String(params.include_predictions  ?? true),
      include_demographics: String(params.include_demographics ?? true),
      ...(params.genders && { genders: params.genders }),
      ...(params.ages    && { ages:    params.ages }),
    });

    const response = await fetch(
      `${API_BASE}/pinterest/trends/top?${query.toString()}`
    );
    if (!response.ok) return null;
    return response.json() as Promise<TopTrendsResponse>;
  } catch {
    console.error("[pinterest] fetchTopTrends failed");
    return null;
  }
}

// ─── Keyword trend ────────────────────────────────────────────────────────────

export interface KeywordTrendResponse {
  keyword: string;
  region:  string;
  found:   boolean;
  total?:  number;
  trends:  TrendResult[];
}

export async function fetchKeywordTrend(
  keyword:    string,
  region      = "US",
  trend_type  = "monthly"
): Promise<TrendResult[]> {
  try {
    const cleanKeyword = extractKeyword(keyword);
    console.log(`[pinterest] keyword: "${keyword}" → cleaned: "${cleanKeyword}"`);

    const encoded  = encodeURIComponent(cleanKeyword);
    const response = await fetch(
      `${API_BASE}/pinterest/trends/keyword/${encoded}?trend_type=${trend_type}&region=${region}`
    );

    if (!response.ok) {
      console.warn(`[pinterest] request failed with status ${response.status} — skipping`);
      return [];
    }

    const data = await response.json() as KeywordTrendResponse;
    return data.found ? data.trends : [];
  } catch {
    console.error("[pinterest] fetchKeywordTrend failed");
    return [];
  }
}

// ─── Featured topics ──────────────────────────────────────────────────────────

export interface FeaturedTopic {
  id:          string;
  name:        string;
  description: string;
  image_url:   string;
  trend_url:   string;
}

export interface FeaturedTopicsResponse {
  region: string;
  total:  number;
  topics: FeaturedTopic[];
}

export async function fetchFeaturedTopics(
  region = "US"
): Promise<FeaturedTopicsResponse | null> {
  try {
    const response = await fetch(
      `${API_BASE}/pinterest/trends/featured?region=${region}`
    );
    if (!response.ok) return null;
    return response.json() as Promise<FeaturedTopicsResponse>;
  } catch {
    console.error("[pinterest] fetchFeaturedTopics failed");
    return null;
  }
}

// ─── Trending categories ──────────────────────────────────────────────────────

export interface TrendingCategory {
  id:        string;
  name:      string;
  momentum:  number;
  image_url: string;
}

export interface TrendingCategoriesResponse {
  region:     string;
  total:      number;
  categories: TrendingCategory[];
}

export async function fetchTrendingCategories(
  region = "US"
): Promise<TrendingCategoriesResponse | null> {
  try {
    const response = await fetch(
      `${API_BASE}/pinterest/trends/categories?region=${region}`
    );
    if (!response.ok) return null;
    return response.json() as Promise<TrendingCategoriesResponse>;
  } catch {
    console.error("[pinterest] fetchTrendingCategories failed");
    return null;
  }
}