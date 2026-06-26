// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Feedback Service
// Place at: src/lib/api/feedback.ts
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function submitFeedback(payload: {
  session_id:  string;
  message_idx: number;
  type:        "positive" | "negative";
  context?:    string;
  reasoning?:  string;
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/feedback`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
  } catch {
    console.error("[feedback] submitFeedback failed");
  }
}