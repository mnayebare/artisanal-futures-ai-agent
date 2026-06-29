// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Session Persistence Service
// Place at: src/lib/api/sessions.ts
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredSession {
  id:           string;
  title:        string;
  updatedAt:    string;
  messageCount: number;
}

export interface StoredMessage {
  role:      "user" | "agent";
  text:      string;
  imageUrl?: string;
  metadata?: {
    trends?:       unknown[];
    products?:     unknown[];
    platform?:     string;
    reasoning?:    string;
    reddit_posts?: {
      title:     string;
      url:       string;
      comments:  number;
      score:     number;
      subreddit: string;
    }[];
    intent_data?: {
      intent:    string;
      keyword:   string;
      subreddit: string;
      reason:    string;
      plan:      string[];
    };
  };
  createdAt?: string;
}

// ─── List all sessions ────────────────────────────────────────────────────────

export async function fetchSessions(): Promise<StoredSession[]> {
  try {
    const response = await fetch(`${API_BASE}/sessions`);
    if (!response.ok) return [];
    const data = await response.json() as { sessions: StoredSession[] };
    return data.sessions;
  } catch {
    console.error("[sessions] fetchSessions failed");
    return [];
  }
}

// ─── Create a new session in DB ───────────────────────────────────────────────

export async function createSession(title = "New chat"): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/sessions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { id: string };
    return data.id;
  } catch {
    console.error("[sessions] createSession failed");
    return null;
  }
}

// ─── Load messages for a session ──────────────────────────────────────────────

export async function fetchSessionMessages(sessionId: string): Promise<StoredMessage[]> {
  try {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
    if (!response.ok) return [];
    const data = await response.json() as { messages: StoredMessage[] };
    return data.messages;
  } catch {
    console.error("[sessions] fetchSessionMessages failed");
    return [];
  }
}

// ─── Save messages after each exchange ───────────────────────────────────────

export async function saveSessionMessages(
  sessionId: string,
  title:     string,
  messages:  { role: string; text: string; metadata?: unknown }[]
): Promise<void> {
  try {
    await fetch(`${API_BASE}/sessions/save`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ session_id: sessionId, title, messages }),
    });
  } catch {
    console.error("[sessions] saveSessionMessages failed");
  }
}

// ─── Delete a session ─────────────────────────────────────────────────────────

export async function deleteSessionFromDB(sessionId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/sessions/${sessionId}`, { method: "DELETE" });
  } catch {
    console.error("[sessions] deleteSession failed");
  }
}