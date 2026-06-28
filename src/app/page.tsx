"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  sendChatMessage,
  needsPlatformSelection,
  PLATFORM_OPTIONS,
  fetchSessions,
  createSession,
  fetchSessionMessages,
  saveSessionMessages,
  deleteSessionFromDB,
  submitFeedback,
  type StoredSession,
  type TrendPlatform,
  type TrendResult,
  type Product,
} from "~/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "agent" | "user";

interface Message {
  role:              Role;
  text:              string;
  trends?:           TrendResult[];
  platform?:         TrendPlatform;
  awaitingPlatform?: boolean;
  reasoning?:        string;
  feedback?:         "positive" | "negative" | null;
  redditPosts?:      RedditPost[];
  bestPlatform?:     "google" | "reddit" | "either";
  intentData?: {
    intent:        string;
    keyword:       string;
    subreddit:     string;
    best_platform: string;
    reason:        string;
  };
}

interface RedditPost {
  title:    string;
  url:      string;
  comments: number;
  score:    number;
  subreddit: string;
}

interface ChatSession {
  id:        string;
  title:     string;
  messages:  Message[];
  results:   Product[];
  reasoning: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

// Olive brand palette
const olive = {
  50:  "#f6f7ee",
  100: "#e8eccc",
  200: "#d4da9e",
  300: "#bfc87a",
  400: "#a8b44e",
  600: "#6b7a1f",
  700: "#536015",
  800: "#3c4710",
  900: "#272e09",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeWelcomeMessage(): Message {
  return {
    role: "agent",
    text: "Hi! I'm your Olive Mode shopping assistant. Tell me what you're looking for — an occasion, a style, a budget — and I'll find the right pieces for you.",
  };
}

// ─── Resize hook ─────────────────────────────────────────────────────────────

function useResize(
  initial: number,
  min: number,
  max: number,
  direction: "right" | "left" = "right"
) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = direction === "right"
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      setWidth(Math.min(max, Math.max(min, startW.current + delta)));
    }
    function onUp() {
      dragging.current               = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [direction, max, min]);

  return { width, onMouseDown };
}

// ─── Drag handle ─────────────────────────────────────────────────────────────

function DragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      role="separator"
      aria-label="Resize panel"
      className="w-1 cursor-col-resize flex-shrink-0"
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = olive[200])}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
      style={{ backgroundColor: "transparent", transition: "background-color 0.15s" }}
    />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ role }: { role: Role }) {
  if (role === "agent") {
    return (
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{ backgroundColor: olive[100], color: olive[700] }}
      >
        OM
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-500">
      You
    </div>
  );
}

// ─── SparkBar ─────────────────────────────────────────────────────────────────

function SparkBar({ values, dates }: { values: number[]; dates?: string[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);

  // Y-axis labels — show max, mid, min
  const mid = Math.round((max + min) / 2);

  // Extract unique months from dates for x-axis labels
  const monthLabels: { index: number; label: string }[] = [];
  if (dates) {
    let lastMonth = "";
    dates.forEach((d, i) => {
      const month = new Date(d).toLocaleString("default", { month: "short" });
      if (month !== lastMonth) {
        monthLabels.push({ index: i, label: month });
        lastMonth = month;
      }
    });
  }

  return (
    <div className="flex gap-1.5">
      {/* Y-axis */}
      <div className="flex flex-col justify-between items-end pb-3" style={{ minWidth: 24 }}>
        <span className="text-[9px] text-stone-400">{max}</span>
        <span className="text-[9px] text-stone-400">{mid}</span>
        <span className="text-[9px] text-stone-400">{min}</span>
      </div>

      {/* Chart area */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-0.5 h-10">
          {values.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height:          `${Math.max(4, (v / max) * 40)}px`,
                backgroundColor: i === values.length - 1 ? olive[600] : olive[200],
              }}
            />
          ))}
        </div>
        {/* Month labels */}
        {monthLabels.length > 0 && (
          <div className="relative h-3">
            {monthLabels.map(({ index, label }) => (
              <span
                key={label}
                className="absolute text-[9px] text-stone-400"
                style={{ left: `${(index / values.length) * 100}%` }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TrendCard ────────────────────────────────────────────────────────────────

function TrendCard({ trend }: { trend: TrendResult }) {
  const counts   = trend.weekly_counts ?? [];
  const latest   = counts[counts.length - 1]  ?? 0;
  const previous = counts[counts.length - 2]  ?? latest;
  const change   = previous > 0
    ? Math.round(((latest - previous) / previous) * 100)
    : 0;

  return (
    <div
      className="rounded-xl border p-3 text-xs"
      style={{ borderColor: olive[200], backgroundColor: olive[50] }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-sm capitalize" style={{ color: olive[800] }}>
            {trend.keyword}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {trend.is_trending && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: olive[100], color: olive[700] }}
              >
                Trending now
              </span>
            )}
            {trend.prediction && (
              <span className="text-[10px] text-stone-400 capitalize">
                {trend.prediction}
              </span>
            )}
          </div>
        </div>
        {change !== 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0"
            style={{
              backgroundColor: change > 0 ? "#dcfce7" : "#fee2e2",
              color:           change > 0 ? "#15803d" : "#b91c1c",
            }}
          >
            {change > 0 ? "▲" : "▼"} {Math.abs(change)}%
          </span>
        )}
      </div>

      {/* Spark chart with month labels */}
      {counts.length > 0 && (
        <SparkBar values={counts} dates={trend.dates} />
      )}
    </div>
  );
}

// ─── PlatformSelector ─────────────────────────────────────────────────────────

function PlatformSelector({
  onSelect,
  recommended,
}: {
  onSelect:     (platform: TrendPlatform) => void;
  recommended?: "google" | "reddit" | "either";
}) {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {recommended && recommended !== "either" && (
        <p className="text-[11px] px-1" style={{ color: olive[600] }}>
          💡 {recommended === "google"
            ? "Agent recommends Google Trends for quantitative data"
            : "Agent recommends Reddit for community sentiment"}
        </p>
      )}
      {PLATFORM_OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => option.available && onSelect(option.id)}
          disabled={!option.available}
          className="flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition"
          style={{
            borderColor:     recommended === option.id ? olive[600] : option.available ? olive[300] : "#e7e5e4",
            backgroundColor: recommended === option.id ? olive[50]  : option.available ? "#fff"     : "#fafaf9",
            opacity:         option.available ? 1 : 0.5,
            cursor:          option.available ? "pointer" : "not-allowed",
          }}
          onMouseEnter={e => {
            if (option.available)
              (e.currentTarget as HTMLElement).style.backgroundColor = olive[50];
          }}
          onMouseLeave={e => {
            if (option.available)
              (e.currentTarget as HTMLElement).style.backgroundColor =
                recommended === option.id ? olive[50] : "#fff";
          }}
        >
          {/* Icon */}
          <div
            className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
            style={{ backgroundColor: olive[100], color: olive[700] }}
          >
            {option.id === "google" ? "G" : option.id === "reddit" ? "R" : "P"}
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-stone-800">{option.label}</p>
              {recommended === option.id && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: olive[200], color: olive[800] }}
                >
                  Recommended
                </span>
              )}
              {!option.available && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  style={{ backgroundColor: olive[50], color: olive[600] }}
                >
                  Pending approval
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">{option.description}</p>
          </div>

          {/* Arrow */}
          {option.available && (
            <svg className="h-4 w-4 flex-shrink-0 mt-1 text-stone-300" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── ChatBubble ───────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  messageIdx,
  onPlatformSelect,
  onFeedback,
}: {
  message:          Message;
  messageIdx:       number;
  onPlatformSelect?: (platform: TrendPlatform) => void;
  onFeedback?:      (idx: number, type: "positive" | "negative") => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={`flex items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
      <Avatar role={message.role} />
      <div className="flex flex-col gap-1 min-w-0 flex-1 max-w-[85%]">

        {/* Text bubble */}
        <div
          className="rounded-2xl px-3 py-2 text-sm leading-relaxed"
          style={
            message.role === "user"
              ? { backgroundColor: olive[100], color: olive[800], borderBottomRightRadius: 4 }
              : { backgroundColor: "#f5f5f4", color: "#292524", borderBottomLeftRadius: 4 }
          }
        >
          {message.role === "agent"
            ? message.text.split("\n").map((line, i) => {
                // Indented arrow link:   → [title](url)
                const arrowLink = /^\s+→\s*\[([^\]]+)\]\(([^)]+)\)(.*)$/.exec(line);
                if (arrowLink) {
                  return (
                    <p key={i} className="ml-4 mt-0.5 flex items-start gap-1">
                      <span className="text-stone-400 text-xs mt-0.5">→</span>
                      <a
                        href={arrowLink[2]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-xs font-medium hover:opacity-80"
                        style={{ color: olive[700] }}
                      >
                        {arrowLink[1]}
                      </a>
                    </p>
                  );
                }

                // Bullet line with embedded markdown link: • text → [title](url)
                const bulletWithLink = /^[•\-]\s*(.+?)\s*→\s*\[([^\]]+)\]\(([^)]+)\)(.*)$/.exec(line);
                if (bulletWithLink) {
                  return (
                    <p key={i} className="mt-1 flex items-start gap-1.5">
                      <span style={{ color: olive[400] }}>•</span>
                      <span className="text-sm">
                        <span>{bulletWithLink[1]} → </span>
                        <a
                          href={bulletWithLink[3]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium hover:opacity-80"
                          style={{ color: olive[700] }}
                        >
                          {bulletWithLink[2]}
                        </a>
                        {bulletWithLink[4] && (
                          <span className="text-stone-500">{bulletWithLink[4]}</span>
                        )}
                      </span>
                    </p>
                  );
                }

                // Bullet line with just a markdown link: • [title](url) N comments
                const bulletLink = /^[•\-]\s*\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/.exec(line);
                if (bulletLink) {
                  return (
                    <p key={i} className="mt-1 flex items-start gap-1.5">
                      <span style={{ color: olive[400] }}>•</span>
                      <span>
                        <a
                          href={bulletLink[2]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium hover:opacity-80"
                          style={{ color: olive[700] }}
                        >
                          {bulletLink[1]}
                        </a>
                        {bulletLink[3] && (
                          <span className="text-stone-400 text-xs ml-1.5">
                            {bulletLink[3]}
                          </span>
                        )}
                      </span>
                    </p>
                  );
                }

                // Regular line
                return (
                  <p key={i} className={i > 0 && line ? "mt-1" : ""}>
                    {line}
                  </p>
                );
              })
            : message.text
          }
        </div>

        {/* Agent action buttons — copy + feedback */}
        {message.role === "agent" && !message.awaitingPlatform && (
          <div className="flex items-center gap-1 px-1">
            {/* Copy */}
            <button
              onClick={handleCopy}
              title="Copy response"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              {copied ? (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {copied ? "Copied" : "Copy"}
            </button>

            {/* Thumbs up */}
            <button
              onClick={() => onFeedback?.(messageIdx, "positive")}
              title="Good response"
              className="rounded-lg p-1.5 transition hover:bg-stone-100"
              style={{
                color: message.feedback === "positive" ? olive[600] : "#a8a29e",
              }}
            >
              <svg className="h-4 w-4" fill={message.feedback === "positive" ? "currentColor" : "none"}
                stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </button>

            {/* Thumbs down */}
            <button
              onClick={() => onFeedback?.(messageIdx, "negative")}
              title="Poor response"
              className="rounded-lg p-1.5 transition hover:bg-stone-100"
              style={{
                color: message.feedback === "negative" ? "#b91c1c" : "#a8a29e",
              }}
            >
              <svg className="h-4 w-4" fill={message.feedback === "negative" ? "currentColor" : "none"}
                stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            </button>
          </div>
        )}

        {/* Platform selector */}
        {message.awaitingPlatform && onPlatformSelect && (
          <PlatformSelector
            onSelect={onPlatformSelect}
            recommended={message.bestPlatform}
          />
        )}

        {/* Trend cards */}
        {message.role === "agent" && message.trends && message.trends.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest px-1"
              style={{ color: olive[600] }}>
              {message.platform === "pinterest" ? "Pinterest trends" : "Google trends"}
            </p>
            {message.trends.map((trend, i) => (
              <TrendCard key={i} trend={trend} />
            ))}
          </div>
        )}

        {/* Intent reason — shown below user messages so owner can verify understanding */}
        {message.role === "user" && message.intentData?.reason && (
          <div className="flex justify-end">
            <div
              className="flex items-start gap-1.5 rounded-lg px-2 py-1.5 max-w-[90%]"
              style={{ backgroundColor: olive[50], border: `1px solid ${olive[200]}` }}
            >
              <svg className="h-3 w-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
                viewBox="0 0 24 24" style={{ color: olive[600] }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-[10px] leading-relaxed" style={{ color: olive[700] }}>
                <span className="font-semibold">Agent understood: </span>
                {message.intentData.reason}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <Avatar role="agent" />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-stone-100 px-3 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-white p-3">
      {product.imageUrl && (
        <Image
          src={product.imageUrl}
          alt={product.name}
          width={300}
          height={128}
          className="mb-2 h-32 w-full rounded-lg object-cover"
        />
      )}
      <p className="text-[10px] uppercase tracking-widest text-stone-400">
        {product.category}
      </p>
      <p className="mt-0.5 text-sm font-medium text-stone-800">{product.name}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: olive[600] }}>
          ${product.price.toFixed(2)}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={
            product.inStock
              ? { backgroundColor: olive[50],  color: olive[700] }
              : { backgroundColor: "#fef2f2", color: "#b91c1c"  }
          }
        >
          {product.inStock ? "In stock" : "Out of stock"}
        </span>
      </div>
    </div>
  );
}

// ─── EmptyResults ─────────────────────────────────────────────────────────────

function EmptyResults() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-stone-400">
      <svg className="h-8 w-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <p className="text-xs leading-relaxed">
        Results appear here as you chat with the assistant.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id:        generateId(),
      title:     "New chat",
      messages:  [makeWelcomeMessage()],
      results:   [],
      reasoning: null,
    },
  ]);
  const [activeId,      setActiveId]      = useState<string>(sessions[0]!.id);
  const [input,         setInput]         = useState("");
  const [isTyping,      setIsTyping]      = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{
    name: string; base64: string; preview: string;
  } | null>(null);
  const [pendingMessage,   setPendingMessage]   = useState<string | null>(null);
  const [deleteSessionId,  setDeleteSessionId]  = useState<string | null>(null);
  const [menuSessionId,    setMenuSessionId]    = useState<string | null>(null);
  const [dbSessionId,      setDbSessionId]      = useState<string | null>(null);
  const [chatHistory,      setChatHistory]      = useState<StoredSession[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const left  = useResize(200, 160, 320, "right");
  const right = useResize(420, 320, 580, "left");

  const activeSession = sessions.find((s) => s.id === activeId)!;

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages, isTyping]);

  // Load chat history from DB on mount
  useEffect(() => {
    void fetchSessions().then(data => {
      console.log("[history] fetched sessions:", JSON.stringify(data, null, 2));
      setChatHistory(data);
    });
  }, []);

  // ── Session helpers ───────────────────────────────────────────────────────

  function newChat() {
    const session: ChatSession = {
      id:        generateId(),
      title:     "New chat",
      messages:  [makeWelcomeMessage()],
      results:   [],
      reasoning: null,
    };
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setInput("");
    setUploadedImage(null);
    setPendingMessage(null);
    setIsTyping(false);
    setDbSessionId(null); // will be created on first message
    if (textareaRef.current) {
      textareaRef.current.value        = "";
      textareaRef.current.style.height = "64px";
    }
  }

  function updateSession(id: string, patch: Partial<ChatSession>) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function deleteSession(id: string) {
    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const fresh: ChatSession = {
        id:        generateId(),
        title:     "New chat",
        messages:  [makeWelcomeMessage()],
        results:   [],
        reasoning: null,
      };
      setSessions([fresh]);
      setActiveId(fresh.id);
    } else {
      setSessions(remaining);
      if (id === activeId) setActiveId(remaining[0]!.id);
    }
    setDeleteSessionId(null);
    setMenuSessionId(null);

    // Delete from DB and refresh history
    if (dbSessionId) {
      void deleteSessionFromDB(dbSessionId).then(() =>
        fetchSessions().then(setChatHistory)
      );
      setDbSessionId(null);
    }
    // Also remove from chatHistory if it's a persisted session
    setChatHistory(prev => prev.filter(s => s.id !== id));
  }

  // ── Image upload ──────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadedImage({
        name:    file.name,
        base64:  result.split(",")[1] ?? "",
        preview: result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearImage() {
    setUploadedImage(null);
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage(platform?: TrendPlatform) {
    const text = (pendingMessage ?? input).trim();
    if (!text || isTyping) return;

    // If this is a trend query and no platform chosen yet — show selector
    if (!platform && needsPlatformSelection(text)) {
      setPendingMessage(text);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "64px";
      // Add the user message + selector prompt to the chat
      const userMessage: Message = { role: "user", text };
      // Pre-fetch intent to get platform recommendation
      let bestPlatform: "google" | "reddit" | "either" = "either";
      try {
        const intentRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/chat/intent`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            message: text,
            history: activeSession.messages.map(m => ({ role: m.role, text: m.text })),
          }),
        });
        if (intentRes.ok) {
          const intentData = await intentRes.json() as { best_platform?: "google" | "reddit" | "either" };
          bestPlatform = intentData.best_platform ?? "either";
        }
      } catch { /* fall through with default */ }

      updateSession(activeId, {
        messages: [
          ...activeSession.messages,
          userMessage,
          {
            role:             "agent",
            text:             "Which platform would you like to get trend data from?",
            awaitingPlatform: true,
            bestPlatform,
          },
        ],
      });
      return;
    }

    // Clear pending state
    setPendingMessage(null);

    // Remove awaitingPlatform message — user message is already in chat from first call
    const cleanMessages   = activeSession.messages.filter(m => !m.awaitingPlatform);
    // Only add user message if it's not already the last user message in the chat
    const lastUserMsg     = [...cleanMessages].reverse().find(m => m.role === "user");
    const alreadyAdded    = lastUserMsg?.text === text;
    const updatedMessages = alreadyAdded
      ? cleanMessages
      : [...cleanMessages, { role: "user" as const, text }];

    const isFirst  = activeSession.messages.filter(m => m.role === "user").length === 0
                  && !alreadyAdded;
    const newTitle = isFirst
      ? text.length > 30 ? text.slice(0, 30) + "…" : text
      : activeSession.title === "New chat" && text.length > 0
        ? text.length > 30 ? text.slice(0, 30) + "…" : text
        : activeSession.title;

    updateSession(activeId, { messages: updatedMessages, title: newTitle });
    setInput("");
    setUploadedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = "64px";
    setIsTyping(true);

    try {
      // Single API call — /chat handles intent detection, trends, and reply
      const chatData = await sendChatMessage({
        message:  text,
        history:  updatedMessages.map((m) => ({
          role: m.role,
          text: m.text,
          metadata: m.reasoning ?? m.trends ?? m.intentData ? {
            reasoning:   m.reasoning,
            trends:      m.trends,
            platform:    m.platform,
            intent_data: m.intentData,
          } : undefined,
        })),
        platform,
        ...(uploadedImage && { image_base64: uploadedImage.base64 }),
      });

      if (!chatData) throw new Error("Chat API returned null");

      const trendResults = chatData.trends ?? [];
      const agentMessage: Message = {
        role:        "agent",
        text:        chatData.reply,
        trends:      trendResults.length > 0 ? trendResults : undefined,
        platform,
        reasoning:   chatData.reasoning,
        redditPosts: chatData.reddit_posts,
        intentData:  chatData.intent_data,
        feedback:    null,
      };

      // Backfill intent data onto the user message so the reason shows below it
      const messagesWithIntent = [...updatedMessages, agentMessage].map((m, idx) => {
        if (idx === updatedMessages.length - 1 && m.role === "user" && chatData.intent_data) {
          return { ...m, intentData: chatData.intent_data };
        }
        return m;
      });

      // Use server-generated title if available, otherwise keep current
      const finalTitle = chatData.suggested_title ?? newTitle;

      updateSession(activeId, {
        messages:  messagesWithIntent,
        results:   chatData.products ?? activeSession.results,
        title:     finalTitle,
        reasoning: chatData.reasoning ?? activeSession.reasoning,
      });

      // Persist to DB
      const sid = dbSessionId ?? await createSession(finalTitle);
      if (sid) {
        setDbSessionId(sid);
        await saveSessionMessages(
          sid,
          finalTitle,
          messagesWithIntent.map(m => ({
            role:     m.role,
            text:     m.text,
            metadata: m.trends || m.platform || m.reasoning || m.redditPosts || m.intentData ? {
              trends:       m.trends,
              platform:     m.platform,
              reasoning:    m.reasoning,
              reddit_posts: m.redditPosts,
              intent_data:  m.intentData,
            } : undefined,
          }))
        );
        void fetchSessions().then(setChatHistory);
      }

    } catch {
      updateSession(activeId, {
        messages: [
          ...updatedMessages,
          {
            role: "agent",
            text: "Sorry, I couldn't reach the server. Please check that the API is running and try again.",
          },
        ],
      });
    } finally {
      setIsTyping(false);
    }
  }

  function handleFeedback(messageIdx: number, type: "positive" | "negative") {
    // Update message feedback state
    const updatedMessages = activeSession.messages.map((m, i) =>
      i === messageIdx ? { ...m, feedback: type } : m
    );
    updateSession(activeId, { messages: updatedMessages });

    // Save to DB
    if (dbSessionId) {
      const msg = activeSession.messages[messageIdx];
      void submitFeedback({
        session_id:  dbSessionId,
        message_idx: messageIdx,
        type,
        context:     msg?.text,
        reasoning:   activeSession.reasoning ?? undefined,
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(undefined);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "64px";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 font-sans text-stone-900 antialiased">

      {/* ── Left panel ── */}
      <aside
        className="flex flex-shrink-0 flex-col border-r border-stone-200 bg-stone-100"
        style={{ width: left.width }}
      >
        {/* Brand */}
        <div className="border-b border-stone-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: olive[600], color: "#fff" }}
            >
              OM
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-stone-800">Olive Mode</p>
              <p className="text-[10px] text-stone-400">AI sales agent</p>
            </div>
          </div>
        </div>

        {/* New chat */}
        <div className="px-3 pt-3">
          <button
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-800"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-stone-400">Recent</p>
          {sessions.map((session) => (
            <div
              key={session.id}
              className="group relative mb-0.5 flex items-center rounded-lg transition"
              style={session.id === activeId ? { backgroundColor: olive[50] } : {}}
              onMouseEnter={e => {
                if (session.id !== activeId)
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
              }}
              onMouseLeave={e => {
                if (session.id !== activeId)
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <button
                onClick={() => { setActiveId(session.id); setMenuSessionId(null); }}
                className="flex flex-1 min-w-0 items-center gap-2 px-2 py-2 text-left text-xs"
                style={{ color: session.id === activeId ? olive[800] : "#78716c",
                         fontWeight: session.id === activeId ? 500 : 400 }}
              >
                <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="truncate">{session.title}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuSessionId(menuSessionId === session.id ? null : session.id);
                }}
                className="mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "#a8a29e" }}
                aria-label="Session options"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
              {menuSessionId === session.id && (
                <div className="absolute right-1 top-8 z-50 rounded-lg border border-stone-200 bg-white py-1 shadow-lg" style={{ minWidth: 110 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSessionId(session.id);
                      setMenuSessionId(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 transition"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* ── DB Chat History ── */}
          {chatHistory.length > 0 && (
            <>
              <p className="mb-2 mt-4 px-1 text-[10px] uppercase tracking-widest text-stone-400">
                Chat history
              </p>
              {chatHistory.map((stored) => (
                <div
                  key={stored.id}
                  className="group relative mb-0.5 flex items-center rounded-lg transition"
                  style={activeId === stored.id ? { backgroundColor: olive[50] } : {}}
                  onMouseEnter={e => {
                    if (activeId !== stored.id)
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
                  }}
                  onMouseLeave={e => {
                    if (activeId !== stored.id)
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  <button
                    onClick={async () => {
                      const existing = sessions.find(s => s.id === stored.id);
                      if (existing) {
                        setActiveId(stored.id);
                        setDbSessionId(stored.id);
                        return;
                      }
                      const msgs = await fetchSessionMessages(stored.id);

                      // Extract the most recent reasoning from message metadata
                      const lastReasoning = [...msgs]
                        .reverse()
                        .find(m => m.metadata?.reasoning)
                        ?.metadata?.reasoning;

                      const session: ChatSession = {
                        id:        stored.id,
                        title:     stored.title,
                        messages:  msgs.length > 0
                          ? msgs.map(m => ({
                              role:        m.role,
                              text:        m.text,
                              trends:      m.metadata?.trends as TrendResult[] | undefined,
                              platform:    m.metadata?.platform as TrendPlatform | undefined,
                              reasoning:   m.metadata?.reasoning,
                              redditPosts: m.metadata?.reddit_posts,
                            }))
                          : [makeWelcomeMessage()],
                        results:   [],
                        reasoning: lastReasoning ?? null,
                      };
                      setSessions(prev => [session, ...prev.filter(s => s.id !== stored.id)]);
                      setActiveId(stored.id);
                      setDbSessionId(stored.id);
                      setInput("");
                      setUploadedImage(null);
                      setPendingMessage(null);
                      if (textareaRef.current) textareaRef.current.style.height = "64px";
                    }}
                    className="flex flex-1 min-w-0 flex-col px-2 py-2 text-left"
                    style={{
                      color:      activeId === stored.id ? olive[800] : "#78716c",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span
                        className="truncate text-xs"
                        style={{ fontWeight: activeId === stored.id ? 500 : 400 }}
                      >
                        {stored.title}
                      </span>
                    </div>
                    <p className="ml-5 text-[10px] text-stone-400">
                      {stored.messageCount} message{stored.messageCount !== 1 ? "s" : ""} ·{" "}
                      {new Date(stored.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteSessionFromDB(stored.id).then(() =>
                        fetchSessions().then(setChatHistory)
                      );
                      setSessions(prev => prev.filter(s => s.id !== stored.id));
                      if (activeId === stored.id) {
                        const remaining = sessions.filter(s => s.id !== stored.id);
                        setActiveId(remaining[0]?.id ?? generateId());
                      }
                    }}
                    className="mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400 transition-opacity"
                    aria-label="Delete from history"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ── Left drag handle ── */}
      <DragHandle onMouseDown={left.onMouseDown} />

      {/* ── Main panel ── */}
      <main className="flex min-w-0 flex-1 flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-5 py-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: olive[600], color: "#fff" }}
          >
            OM
          </div>
          <div>
            <p className="text-sm font-medium text-stone-800">Shopping assistant</p>
            <p className="text-xs text-stone-400">Powered by Olive Mode × AI</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-stone-400">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-4">
            {activeSession.messages.map((msg, i) => (
              <ChatBubble
                key={i}
                message={msg}
                messageIdx={i}
                onPlatformSelect={(platform) => void sendMessage(platform)}
                onFeedback={handleFeedback}
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-stone-200 bg-white px-5 py-4">
          <div className="mx-auto max-w-2xl">

            {/* Image preview — disabled until next iteration */}

            {/* Input row */}
            <div className="flex items-end gap-2">

              {/* Hidden file input — disabled until next iteration */}

              {/* Upload button — disabled until next iteration */}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a style, occasion, or budget…"
                rows={2}
                className="flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-800 placeholder-stone-400 outline-none transition leading-relaxed"
                style={{ height: "64px", maxHeight: "160px" }}
                onFocus={e => {
                  e.target.style.borderColor       = olive[400];
                  e.target.style.backgroundColor   = "#fff";
                  e.target.style.boxShadow         = `0 0 0 3px ${olive[100]}`;
                }}
                onBlur={e => {
                  e.target.style.borderColor       = "";
                  e.target.style.backgroundColor   = "";
                  e.target.style.boxShadow         = "";
                }}
              />

              {/* Send button */}
              <button
                onClick={() => void sendMessage(undefined)}
                disabled={!input.trim() || isTyping}
                aria-label="Send message"
                className="flex h-14 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: olive[600] }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = olive[700])}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = olive[600])}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-stone-300">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>

      {/* ── Right drag handle ── */}
      <DragHandle onMouseDown={right.onMouseDown} />

      {/* ── Right panel ── */}
      <aside
        className="flex flex-shrink-0 flex-col border-l border-stone-200 bg-white"
        style={{ width: right.width }}
      >
        {/* Header — shows Reasoning or Results depending on content */}
        <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: olive[600] }}>
            {activeSession.reasoning
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            }
          </svg>
          <p className="text-sm font-medium text-stone-700">
            {activeSession.reasoning ? "Reasoning" : "Results"}
          </p>
          {!activeSession.reasoning && activeSession.results.length > 0 && (
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: olive[100], color: olive[700] }}
            >
              {activeSession.results.length}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          {activeSession.reasoning ? (
            /* ── Reasoning view ── */
            <div className="flex flex-col gap-4">
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: olive[200], backgroundColor: olive[50] }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ color: olive[600] }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p className="text-[10px] uppercase tracking-widest font-medium"
                      style={{ color: olive[700] }}>
                      AI Analysis
                    </p>
                  </div>
                  {/* Copy reasoning button */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(activeSession.reasoning ?? "");
                      }}
                      title="Copy analysis"
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-stone-400 transition hover:bg-white hover:text-stone-600"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>

                    {/* Thumbs up */}
                    <button
                      onClick={() => {
                        if (dbSessionId) {
                          void submitFeedback({
                            session_id:  dbSessionId,
                            message_idx: -1,
                            type:        "positive",
                            context:     "reasoning",
                            reasoning:   activeSession.reasoning ?? undefined,
                          });
                        }
                      }}
                      title="Helpful analysis"
                      className="rounded-lg p-1.5 transition hover:bg-white"
                      style={{ color: olive[400] }}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                    </button>

                    {/* Thumbs down */}
                    <button
                      onClick={() => {
                        if (dbSessionId) {
                          void submitFeedback({
                            session_id:  dbSessionId,
                            message_idx: -1,
                            type:        "negative",
                            context:     "reasoning",
                            reasoning:   activeSession.reasoning ?? undefined,
                          });
                        }
                      }}
                      title="Not helpful"
                      className="rounded-lg p-1.5 transition hover:bg-white"
                      style={{ color: "#a8a29e" }}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-stone-700 whitespace-pre-wrap">
                  {activeSession.reasoning.split("\n").map((line, i) => {
                    // Section headers **bold**
                    const headerMatch = /^\*\*(.+)\*\*$/.exec(line.trim());
                    if (headerMatch) {
                      return (
                        <span key={i} className="block mt-3 mb-1 text-xs font-semibold"
                          style={{ color: olive[700] }}>
                          {headerMatch[1]}
                        </span>
                      );
                    }
                    // Suggested post label
                    const suggestedMatch = /^(Suggested .+ Post:)(.*)$/.exec(line.trim());
                    if (suggestedMatch?.[1]) {
                      return (
                        <span key={i} className="block mt-2">
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mr-1"
                            style={{ backgroundColor: olive[100], color: olive[700] }}
                          >
                            {suggestedMatch[1].replace(":", "")}
                          </span>
                          {suggestedMatch[2] ?? ""}
                        </span>
                      );
                    }
                    return (
                      <span key={i} className={line.trim() ? "block" : "block h-2"}>
                        {line}
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>
          ) : activeSession.results.length === 0 ? (
            /* ── Empty state ── */
            <EmptyResults />
          ) : (
            /* ── Product results ── */
            <div className="flex flex-col gap-3">
              {activeSession.results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Click outside to close menu ── */}
      {menuSessionId && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuSessionId(null)} />
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setDeleteSessionId(null)}
          />
          <div className="relative z-10 w-72 rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: "#fef2f2" }}
            >
              <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-stone-800">Delete chat?</p>
            <p className="mt-1 text-xs text-stone-400">
              {sessions.find(s => s.id === deleteSessionId)?.title ?? "This chat"} will be permanently removed.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteSessionId(null)}
                className="flex-1 rounded-lg border border-stone-200 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSession(deleteSessionId)}
                className="flex-1 rounded-lg bg-red-500 py-2 text-xs font-medium text-white transition hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
