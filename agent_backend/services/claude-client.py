# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Claude Client
# File: services/claude_client.py
#
# Calls the Anthropic API with tools.
# Claude reads the user message, decides which tools to call,
# and synthesizes a final reply from the results.
#
# Add to .env:
#   ANTHROPIC_API_KEY=your_key_here
# ─────────────────────────────────────────────────────────────────────────────

import os
import json
import anthropic

from services.pytrends_client import (
    get_pytrends,
    build_payload,
    interest_over_time,
    calculate_momentum,
    shape_related,
)

# ─── Client ───────────────────────────────────────────────────────────────────

def get_claude() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in environment variables.")
    return anthropic.Anthropic(api_key=api_key)


# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are the AI shopping assistant for Olive Mode Boutique — a Black-owned 
women's fashion boutique based in Detroit at the MBAD African Bead Museum.

Your personality:
- Warm, knowledgeable, and style-savvy
- You speak like a trusted friend who knows fashion
- You celebrate the cultural identity of the boutique and its customers
- You are concise — no long paragraphs, keep replies conversational

Your capabilities:
- Search the Olive Mode product catalog
- Look up what's trending on Google Trends for fashion keywords
- Find rising related search queries to spot early trends
- Get regional interest to know where a style is hottest

When a customer asks about trends AND products, use both tools and weave 
the results together. Always tie trend data back to what Olive Mode carries.

Never make up products. If search returns nothing, say so honestly and 
suggest the customer visit the boutique or check back soon.
""".strip()


# ─── Tool definitions ─────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_products",
        "description": (
            "Search the Olive Mode product catalog by keyword, category, or price. "
            "Use this when the customer is looking for something to buy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {
                    "type":        "string",
                    "description": "Fashion keyword e.g. 'mesh dress', 'crossbody bag'"
                },
                "category": {
                    "type":        "string",
                    "description": "Product category e.g. Dress, Bag, Jewelry, Beauty, Perfume"
                },
                "max_price": {
                    "type":        "number",
                    "description": "Maximum price in USD"
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_google_trends",
        "description": (
            "Get Google Trends interest over time for a fashion keyword. "
            "Use this when the customer asks what's trending, popular, or hot right now."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {
                    "type":        "string",
                    "description": "Clean fashion keyword e.g. 'mesh mini dress'"
                },
                "timeframe": {
                    "type":        "string",
                    "description": "today 1-m | today 3-m | today 12-m",
                    "default":     "today 3-m"
                },
            },
            "required": ["keyword"],
        },
    },
    {
        "name": "get_related_queries",
        "description": (
            "Get rising related search queries for a fashion keyword. "
            "The rising list shows what's growing fast — early trend signals. "
            "Use alongside get_google_trends for deeper trend analysis."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {
                    "type":        "string",
                    "description": "Fashion keyword to find related queries for"
                },
            },
            "required": ["keyword"],
        },
    },
]


# ─── Tool execution ───────────────────────────────────────────────────────────

async def execute_tool(name: str, inputs: dict) -> str:
    """
    Execute a tool call from Claude and return the result as a string.
    Claude reads this string and uses it to form its reply.
    """

    if name == "search_products":
        # TODO: replace with real DB query when database service is ready
        keyword  = inputs.get("keyword", "")
        category = inputs.get("category", "")
        max_price = inputs.get("max_price")

        # Placeholder — returns honest empty state
        return json.dumps({
            "found":    False,
            "keyword":  keyword,
            "category": category,
            "message":  "Product database not yet connected. Coming soon.",
            "products": [],
        })

    if name == "get_google_trends":
        keyword   = inputs.get("keyword", "")
        timeframe = inputs.get("timeframe", "today 3-m")
        try:
            pt = get_pytrends()
            build_payload(pt, [keyword], timeframe, "US")
            df       = interest_over_time(pt)
            momentum = calculate_momentum(df, [keyword])
            kw_mom   = momentum.get(keyword, {})
            values   = df[keyword].tolist() if keyword in df.columns else []

            return json.dumps({
                "keyword":      keyword,
                "found":        not df.empty,
                "direction":    kw_mom.get("direction", "flat"),
                "change_pct":   kw_mom.get("change_pct", 0),
                "current_avg":  kw_mom.get("current_avg", 0),
                "weekly_counts": values[-12:],
            })
        except Exception as e:
            return json.dumps({"error": str(e), "keyword": keyword})

    if name == "get_related_queries":
        keyword = inputs.get("keyword", "")
        try:
            pt = get_pytrends()
            build_payload(pt, [keyword], "today 3-m", "US")
            related = pt.related_queries().get(keyword, {})
            return json.dumps({
                "keyword": keyword,
                "rising":  shape_related(related.get("rising"))[:5],
                "top":     shape_related(related.get("top"))[:5],
            })
        except Exception as e:
            return json.dumps({"error": str(e), "keyword": keyword})

    return json.dumps({"error": f"Unknown tool: {name}"})


# ─── Main agent call ──────────────────────────────────────────────────────────

async def run_agent(
    message: str,
    history: list[dict] | None = None,
) -> dict:
    """
    Send the user message to Claude with tools available.
    Claude decides what to call, we execute the tools, Claude synthesizes the reply.

    Returns:
      reply    — Claude's natural language response
      tools_used — which tools were called
      tool_results — the raw data from each tool call
    """
    client = get_claude()

    # Build conversation history for context
    messages = []
    if history:
        for msg in history:
            role = "user" if msg.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": msg.get("text", "")})

    # Add the current message
    messages.append({"role": "user", "content": message})

    tools_used   = []
    tool_results = []

    # ── Agentic loop ──────────────────────────────────────────────────────────
    # Claude may call multiple tools in sequence before giving a final reply.
    # We keep looping until Claude sends a stop_reason of "end_turn".

    while True:
        response = client.messages.create(
            model      = "claude-sonnet-4-6",
            max_tokens = 1024,
            system     = SYSTEM_PROMPT,
            tools      = TOOLS,
            messages   = messages,
        )

        # If Claude is done — extract the text reply and return
        if response.stop_reason == "end_turn":
            reply = " ".join(
                block.text
                for block in response.content
                if hasattr(block, "text")
            )
            return {
                "reply":        reply,
                "tools_used":   tools_used,
                "tool_results": tool_results,
            }

        # If Claude wants to use tools — execute them and feed results back
        if response.stop_reason == "tool_use":
            # Add Claude's response (with tool_use blocks) to history
            messages.append({
                "role":    "assistant",
                "content": response.content,
            })

            # Execute each tool Claude requested
            tool_result_blocks = []
            for block in response.content:
                if block.type == "tool_use":
                    tools_used.append(block.name)
                    result = await execute_tool(block.name, block.input)
                    tool_results.append({
                        "tool":   block.name,
                        "input":  block.input,
                        "result": json.loads(result),
                    })
                    tool_result_blocks.append({
                        "type":        "tool_result",
                        "tool_use_id": block.id,
                        "content":     result,
                    })

            # Feed tool results back to Claude
            messages.append({
                "role":    "user",
                "content": tool_result_blocks,
            })

        else:
            # Unexpected stop reason — break to avoid infinite loop
            break

    return {
        "reply":        "I had trouble processing that. Please try again.",
        "tools_used":   tools_used,
        "tool_results": tool_results,
    }