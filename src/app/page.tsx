"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "agent" | "user";

interface Message {
  role: Role;
  text: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  imageUrl?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  results: Product[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Olive brand palette
const olive = {
  50:  "#f6f7ee",
  100: "#e8eccc",
  200: "#d4da9e",
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
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "col-resize";
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
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
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
      style={{ backgroundColor: "transparent", transition: "background-color 0.15s" }}
      className="w-1 cursor-col-resize hover:bg-olive-200 flex-shrink-0"
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = olive[200])}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
    />
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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

function ChatBubble({ message }: { message: Message }) {
  return (
    <div className={`flex items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
      <Avatar role={message.role} />
      <div
        className="max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed"
        style={
          message.role === "user"
            ? { backgroundColor: olive[100], color: olive[800], borderBottomRightRadius: 4 }
            : { backgroundColor: "#f5f5f4", color: "#292524", borderBottomLeftRadius: 4 }
        }
      >
        {message.text}
      </div>
    </div>
  );
}

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

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-white p-3">
      {product.imageUrl && (
        // with this
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
              ? { backgroundColor: olive[50], color: olive[700] }
              : { backgroundColor: "#fef2f2", color: "#b91c1c" }
          }
        >
          {product.inStock ? "In stock" : "Out of stock"}
        </span>
      </div>
    </div>
  );
}

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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: generateId(),
      title: "New chat",
      messages: [makeWelcomeMessage()],
      results: [],
    },
  ]);
  const [activeId, setActiveId] = useState<string>(sessions[0]!.id);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<{ name: string; base64: string; preview: string } | null>(null);

  // Three resizable panels
  const left  = useResize(200, 160, 320, "right");
  const right = useResize(260, 180, 400, "left");

  const activeSession = sessions.find((s) => s.id === activeId)!;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages, isTyping]);

  // ── Session helpers ───────────────────────────────────────────────────────

  function newChat() {
    const session: ChatSession = {
      id: generateId(),
      title: "New chat",
      messages: [makeWelcomeMessage()],
      results: [],
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
        name: file.name,
        base64: result.split(",")[1] ?? "",
        preview: result,
      });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function clearImage() {
    setUploadedImage(null);
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || isTyping) return;

    const isFirst = activeSession.messages.length === 1;
    const newTitle = isFirst
      ? text.length > 30 ? text.slice(0, 30) + "…" : text
      : activeSession.title;

    const userMessage: Message = { role: "user", text };
    const updatedMessages = [...activeSession.messages, userMessage];

    updateSession(activeId, { messages: updatedMessages, title: newTitle });
    setInput("");
    setUploadedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = "64px";
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: updatedMessages.map((m) => ({ role: m.role, text: m.text })),
          ...(uploadedImage && { image_base64: uploadedImage.base64 }),
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json() as { reply: string; products?: Product[] };

      updateSession(activeId, {
        messages: [...updatedMessages, { role: "agent", text: data.reply }],
        results: data.products ?? activeSession.results,
      });
    } catch {
      updateSession(activeId, {
        messages: [
          ...updatedMessages,
          { role: "agent", text: "Sorry, I couldn't reach the server. Please check that the API is running and try again." },
        ],
      });
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
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
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {activeSession.messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} />
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
              <Image
                src={uploadedImage.preview}
                alt="Upload preview"
                width={40}
                height={40}
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
                style={uploadedImage ? { borderColor: olive[400], color: olive[600], backgroundColor: olive[50] } : {}}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                </svg>
              </button>

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
                  e.target.style.borderColor = olive[400];
                  e.target.style.backgroundColor = "#fff";
                  e.target.style.boxShadow = `0 0 0 3px ${olive[100]}`;
                }}
                onBlur={e => {
                  e.target.style.borderColor = "";
                  e.target.style.backgroundColor = "";
                  e.target.style.boxShadow = "";
                }}
              />
              <button
                onClick={() => void sendMessage()}
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
