"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  sendChatMessage,
  isTrendQuery,
  needsPlatformSelection,
  PLATFORM_OPTIONS,
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
}

interface ChatSession {
  id:       string;
  title:    string;
  messages: Message[];
  results:  Product[];
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

      {/* Top related queries */}
      {trend.top && trend.top.length > 0 && (
        <div className="mt-3 pt-2 border-t" style={{ borderColor: olive[100] }}>
          <p className="text-[10px] uppercase tracking-widest mb-1.5"
            style={{ color: olive[600] }}>
            Top related searches
          </p>
          <div className="flex flex-col gap-0.5">
            {trend.top.map((q, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded px-1 py-0.5"
                style={q.value >= 50 ? { backgroundColor: olive[50] } : {}}
              >
                <span
                  className="text-[11px] truncate capitalize"
                  style={{ color: q.value >= 50 ? olive[800] : "#78716c" }}
                >
                  {q.value >= 50 && (
                    <span className="mr-1 text-[9px] font-bold" style={{ color: olive[600] }}>●</span>
                  )}
                  {q.query}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:           `${q.value}%`,
                        backgroundColor: q.value >= 50 ? olive[600] : olive[200],
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] w-6 text-right"
                    style={{ color: q.value >= 50 ? olive[700] : "#a8a29e", fontWeight: q.value >= 50 ? 600 : 400 }}
                  >
                    {q.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] mt-1.5" style={{ color: olive[400] }}>
            ● above 50 — strong search interest
          </p>
        </div>
      )}

      {/* Rising queries */}
      {trend.rising && trend.rising.length > 0 && (
        <div className="mt-3 pt-2 border-t" style={{ borderColor: olive[100] }}>
          <p className="text-[10px] uppercase tracking-widest mb-1.5"
            style={{ color: olive[600] }}>
            Rising searches
          </p>
          <div className="flex flex-col gap-0.5">
            {trend.rising.map((q, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-1 py-0.5">
                <span className="text-[11px] truncate capitalize" style={{ color: olive[800] }}>
                  ↑ {q.query}
                </span>
                <span
                  className="text-[10px] font-semibold flex-shrink-0 rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: olive[100], color: olive[700] }}
                >
                  +{q.value >= 1000 ? `${Math.round(q.value / 100) / 10}k` : q.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demographics */}
      {trend.demographics && (
        <div
          className="mt-2 pt-2 border-t grid grid-cols-2 gap-2"
          style={{ borderColor: olive[100] }}
        >
          {Object.keys(trend.demographics.ages).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: olive[600] }}>
                Age
              </p>
              {Object.entries(trend.demographics.ages)
                .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))
                .slice(0, 3)
                .map(([age, pct]) => (
                  <div key={age} className="flex justify-between text-[10px] text-stone-500">
                    <span>{age}</span>
                    <span className="font-medium" style={{ color: olive[700] }}>{pct}</span>
                  </div>
                ))}
            </div>
          )}
          {Object.keys(trend.demographics.genders).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: olive[600] }}>
                Gender
              </p>
              {Object.entries(trend.demographics.genders)
                .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))
                .map(([gender, pct]) => (
                  <div key={gender} className="flex justify-between text-[10px] text-stone-500">
                    <span className="capitalize">{gender}</span>
                    <span className="font-medium" style={{ color: olive[700] }}>{pct}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PlatformSelector ─────────────────────────────────────────────────────────

function PlatformSelector({
  onSelect,
}: {
  onSelect: (platform: TrendPlatform) => void;
}) {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {PLATFORM_OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => option.available && onSelect(option.id)}
          disabled={!option.available}
          className="flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition"
          style={{
            borderColor:     option.available ? olive[300] : "#e7e5e4",
            backgroundColor: option.available ? "#fff"     : "#fafaf9",
            opacity:         option.available ? 1 : 0.5,
            cursor:          option.available ? "pointer" : "not-allowed",
          }}
          onMouseEnter={e => {
            if (option.available)
              (e.currentTarget as HTMLElement).style.backgroundColor = olive[50];
          }}
          onMouseLeave={e => {
            if (option.available)
              (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
          }}
        >
          {/* Icon */}
          <div
            className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
            style={{ backgroundColor: olive[100], color: olive[700] }}
          >
            {option.id === "google" ? "G" : "P"}
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-stone-800">{option.label}</p>
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
  onPlatformSelect,
}: {
  message:          Message;
  onPlatformSelect?: (platform: TrendPlatform) => void;
}) {
  return (
    <div className={`flex items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
      <Avatar role={message.role} />
      <div className="flex flex-col gap-2 min-w-0 flex-1 max-w-[85%]">

        {/* Text bubble */}
        <div
          className="rounded-2xl px-3 py-2 text-sm leading-relaxed"
          style={
            message.role === "user"
              ? { backgroundColor: olive[100], color: olive[800], borderBottomRightRadius: 4 }
              : { backgroundColor: "#f5f5f4", color: "#292524", borderBottomLeftRadius: 4 }
          }
        >
          {message.text}
        </div>

        {/* Platform selector */}
        {message.awaitingPlatform && onPlatformSelect && (
          <PlatformSelector onSelect={onPlatformSelect} />
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
      id:       generateId(),
      title:    "New chat",
      messages: [makeWelcomeMessage()],
      results:  [],
    },
  ]);
  const [activeId,      setActiveId]      = useState<string>(sessions[0]!.id);
  const [input,         setInput]         = useState("");
  const [isTyping,      setIsTyping]      = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{
    name: string; base64: string; preview: string;
  } | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const left  = useResize(200, 160, 320, "right");
  const right = useResize(260, 180, 400, "left");

  const activeSession = sessions.find((s) => s.id === activeId)!;

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages, isTyping]);

  // ── Session helpers ───────────────────────────────────────────────────────

  function newChat() {
    const session: ChatSession = {
      id:       generateId(),
      title:    "New chat",
      messages: [makeWelcomeMessage()],
      results:  [],
    };
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
  }

  function updateSession(id: string, patch: Partial<ChatSession>) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
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
      updateSession(activeId, {
        messages: [
          ...activeSession.messages,
          userMessage,
          {
            role: "agent",
            text: "Which platform would you like to get trend data from?",
            awaitingPlatform: true,
          },
        ],
      });
      return;
    }

    // Clear pending state
    setPendingMessage(null);

    const isFirst  = activeSession.messages.filter(m => m.role === "user").length === 0;
    const newTitle = isFirst
      ? text.length > 30 ? text.slice(0, 30) + "…" : text
      : activeSession.title;

    const userMessage: Message    = { role: "user", text };
    // Remove any awaitingPlatform message before adding new ones
    const cleanMessages = activeSession.messages.filter(m => !m.awaitingPlatform);
    const updatedMessages = [...cleanMessages, userMessage];

    updateSession(activeId, { messages: updatedMessages, title: newTitle });
    setInput("");
    setUploadedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = "64px";
    setIsTyping(true);

    try {
      // Single API call — /chat handles intent detection, trends, and reply
      const chatData = await sendChatMessage({
        message:  text,
        history:  updatedMessages.map((m) => ({ role: m.role, text: m.text })),
        platform,
        ...(uploadedImage && { image_base64: uploadedImage.base64 }),
      });

      if (!chatData) throw new Error("Chat API returned null");

      const trendResults = chatData.trends ?? [];
      const agentMessage: Message = {
        role:    "agent",
        text:    chatData.reply,
        trends:  trendResults.length > 0 ? trendResults : undefined,
        platform,
      };

      updateSession(activeId, {
        messages: [...updatedMessages, agentMessage],
        results:  chatData.products ?? activeSession.results,
      });

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
            <button
              key={session.id}
              onClick={() => setActiveId(session.id)}
              className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition"
              style={
                session.id === activeId
                  ? { backgroundColor: olive[50], color: olive[800], fontWeight: 500 }
                  : { color: "#78716c" }
              }
              onMouseEnter={e => {
                if (session.id !== activeId)
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
              }}
              onMouseLeave={e => {
                if (session.id !== activeId)
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="truncate">{session.title}</span>
            </button>
          ))}
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
                onPlatformSelect={(platform) => void sendMessage(platform)}
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-stone-200 bg-white px-5 py-4">
          <div className="mx-auto max-w-2xl">

            {/* Image preview */}
            {uploadedImage && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedImage.preview}
                  alt="Upload preview"
                  className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                />
                <span className="flex-1 truncate text-xs text-stone-500">{uploadedImage.name}</span>
                <button
                  onClick={clearImage}
                  aria-label="Remove image"
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-500 transition hover:bg-stone-300"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload image"
                title="Upload image"
                className="flex h-14 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-400 transition hover:border-stone-300 hover:text-stone-600"
                style={uploadedImage
                  ? { borderColor: olive[400], color: olive[600], backgroundColor: olive[50] }
                  : {}}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                </svg>
              </button>

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
                disabled={(!input.trim() && !uploadedImage) || isTyping}
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
        <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: olive[600] }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          </svg>
          <p className="text-sm font-medium text-stone-700">Results</p>
          {activeSession.results.length > 0 && (
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: olive[100], color: olive[700] }}
            >
              {activeSession.results.length}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          {activeSession.results.length === 0 ? (
            <EmptyResults />
          ) : (
            activeSession.results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
