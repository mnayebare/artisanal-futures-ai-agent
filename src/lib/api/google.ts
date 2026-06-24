// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Google Trends API Service
// Place at: src/lib/api/google.ts
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleMomentum {
  current_avg:  number;
  previous_avg: number;
  change_pct:   number;
  direction:    "up" | "down" | "flat";
}

export interface GoogleDataPoint {
  date:   string;
  values: Record<string, number>;
}

export interface GoogleKeywordResponse {
  keywords:  string[];
  timeframe: string;
  geo:       string;
  found:     boolean;
  momentum:  Record<string, GoogleMomentum>;
  data:      GoogleDataPoint[];
}

export interface GoogleRelatedQuery {
  query: string;
  value: number;
}

export interface GoogleRelatedResponse {
  keyword: string;
  geo:     string;
  rising:  GoogleRelatedQuery[];   // fast-growing — early trend signals
  top:     GoogleRelatedQuery[];   // highest volume
}

export interface GoogleRegion {
  location: string;
  interest: number;
}

export interface GoogleRegionalResponse {
  keyword:    string;
  geo:        string;
  resolution: string;
  regions:    GoogleRegion[];
}

export interface GoogleCategoryItem {
  category:     string;
  avg_interest: number;
  peak:         number;
  trend:        number[];
}

export interface GoogleCompareResponse {
  geo:        string;
  timeframe:  string;
  categories: GoogleCategoryItem[];
}

// ─── Keyword trend over time ──────────────────────────────────────────────────

export async function fetchGoogleKeywordTrend(
  keywords:  string | string[],
  timeframe  = "today 3-m",
  geo        = "US"
): Promise<GoogleKeywordResponse | null> {
  try {
    const kw = Array.isArray(keywords) ? keywords.join(",") : keywords;
    const params = new URLSearchParams({ keywords: kw, timeframe, geo });
    const response = await fetch(
      `${API_BASE}/google/trends/keyword?${params.toString()}`
    );
    if (!response.ok) return null;
    const data = await response.json() as GoogleKeywordResponse;
    console.log("[google] raw response:", JSON.stringify(data, null, 2));
    return data;
  } catch {
    console.error("[google] fetchGoogleKeywordTrend failed");
    return null;
  }
}

// ─── Related queries ──────────────────────────────────────────────────────────

export async function fetchGoogleRelatedQueries(
  keyword: string,
  geo      = "US"
): Promise<GoogleRelatedResponse | null> {
  try {
    const params = new URLSearchParams({ keyword, geo });
    const response = await fetch(
      `${API_BASE}/google/trends/related?${params.toString()}`
    );
    if (!response.ok) return null;
    return response.json() as Promise<GoogleRelatedResponse>;
  } catch {
    console.error("[google] fetchGoogleRelatedQueries failed");
    return null;
  }
}

// ─── Regional interest ────────────────────────────────────────────────────────

export async function fetchGoogleRegionalInterest(
  keyword:    string,
  geo         = "US",
  resolution  = "REGION"
): Promise<GoogleRegionalResponse | null> {
  try {
    const params = new URLSearchParams({ keyword, geo, resolution });
    const response = await fetch(
      `${API_BASE}/google/trends/regional?${params.toString()}`
    );
    if (!response.ok) return null;
    return response.json() as Promise<GoogleRegionalResponse>;
  } catch {
    console.error("[google] fetchGoogleRegionalInterest failed");
    return null;
  }
}

// ─── Category comparison ──────────────────────────────────────────────────────

export async function fetchGoogleCategoryCompare(
  geo       = "US",
  timeframe = "today 3-m"
): Promise<GoogleCompareResponse | null> {
  try {
    const params = new URLSearchParams({ geo, timeframe });
    const response = await fetch(
      `${API_BASE}/google/trends/compare?${params.toString()}`
    );
    if (!response.ok) return null;
    return response.json() as Promise<GoogleCompareResponse>;
  } catch {
    console.error("[google] fetchGoogleCategoryCompare failed");
    return null;
  }
}