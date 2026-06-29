# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Intent Detection via Claude Haiku
# File: services/intent.py
# ─────────────────────────────────────────────────────────────────────────────

import os
import json
from enum import Enum
import anthropic


class Intent(str, Enum):
    TREND   = "trend"
    PRODUCT = "product"
    GENERAL = "general"
    CLARIFY = "clarify"


async def detect_intent(
    message:  str,
    history:  list[dict] | None = None,
) -> tuple[Intent, str, str, str, list]:
    """
    Use Claude Haiku to classify intent with full conversation context.
    Returns (intent, keyword, subreddit, reason) tuple.
    Agent always runs both Google Trends AND Reddit — no platform selection needed.
    """
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        # Build conversation summary from recent history
        context_str = ""
        if history:
            recent        = history[-6:]
            context_lines = []
            for msg in recent:
                role = "Owner" if msg.get("role") == "user" else "Agent"
                text = msg.get("text", "")[:150]
                context_lines.append(f"{role}: {text}")

                metadata    = msg.get("metadata") or {}
                intent_data = metadata.get("intent_data", {})
                trends      = metadata.get("trends", [])

                if intent_data and isinstance(intent_data, dict):
                    kw  = intent_data.get("keyword", "")
                    rsn = intent_data.get("reason", "")
                    if kw:
                        context_lines.append(
                            f"  [Last classified: keyword='{kw}'"
                            + (f", reason={rsn[:80]}" if rsn else "") + "]"
                        )
                elif trends and isinstance(trends, list):
                    kw = trends[0].get("keyword", "") if isinstance(trends[0], dict) else ""
                    if kw:
                        context_lines.append(f"  [Last trend keyword: '{kw}']")

            context_str = "\n".join(context_lines)

        prompt = f"""You are the routing intelligence for Olive Mode AI — a fashion trend research assistant for a Black-owned women's boutique in Detroit.

The user is the STORE OWNER or BUYER making inventory and sourcing decisions.

NOTE: The system automatically searches BOTH Google Trends (for volume/momentum data) AND Reddit (for community sentiment) on every trend query. You do NOT need to recommend a platform.

AVAILABLE TOOLS:
- Google Trends: Search volume, momentum, rising/falling interest, regional data
- Reddit (r/handbags, r/femalefashionadvice, r/jewelry, r/fragrance): Community opinions
- Etsy API: Market pricing, buyer reviews (automatic)
- Tavily Web Search: FashionGo, Faire, Adjoaa, Mott, Onuli, Busayo, D'IYANU, Africa Imports + Vogue, Elle
- Olive Mode Database: Store's own inventory
- Pinterest: UNAVAILABLE

RECENT CONVERSATION:
{context_str if context_str else "This is the first message"}

CURRENT MESSAGE: "{message}"

Classify this message and respond with ONLY a JSON object:

{{
  "intent": "trend" | "product" | "general" | "clarify",
  "keyword": "2-4 word search term",
  "subreddit": "femalefashionadvice" | "handbags" | "jewelry" | "fragrance",
  "followup_type": "contextual" | "new_trend" | "action" | "general",
  "reasoning": "one sentence explaining classification",
  "plan": ["step 1", "step 2", "step 3"]
}}

Intent rules:
- "trend": owner researching market trends for a product category
  "what about bags?" → TREND for "bag"
  "KITSCH Amber Shores Hair Perfume" → TREND for "hair perfume"
  "What trends for African fashion?" → TREND for "african print dress"
  "get me trends on Somalia Shirt Dress" → TREND for "shirt dress"
- "product": asking about OWN store inventory — existence, stock, pricing, descriptions
  "Is Somalia Shirt Dress in the database?" → PRODUCT, keyword="somalia shirt dress"
  "do we carry X?", "show me X from inventory", "what's the price of X" → PRODUCT
  "Is this product in the database — Somalia Shirt Dress. get me trends on it" →
    PRODUCT first (check inventory), owner can follow up for trends
- "general": conversational — greetings, summaries, AND short affirmations like
  "yes", "sure", "please", "go ahead", "ok", "no" when the previous agent message
  asked a question — ALWAYS "general" for these, never "clarify"
- "clarify": ONLY when genuinely ambiguous AND no recent agent question to reference

IMPORTANT: When a message asks about both inventory AND trends, always use "product"
intent first so the owner gets the inventory answer. They can then ask for trends.

Keyword rules:
- For "trend" intent: extract core product category (2-4 words, no brand names)
  "What's hot in Cabana Mesh Mini Dress?" → "mesh mini dress"
  "get me trends on Somalia Shirt Dress" → "shirt dress"
  African fashion: "ankara dress", "kente cloth", "adire fabric", "african print dress"
- For "product" intent: keep the full product name for exact DB lookup
  "Is Somalia Shirt Dress in the database?" → "Somalia Shirt Dress"
  "do we have Cabana Mesh Mini Dress?" → "Cabana Mesh Mini Dress"
- Follow-ups like "yes" → use keyword from last classified message in history
- 2-4 words max for trend, full name for product

Subreddit rules:
- "handbags": bags, purses, clutches, totes, satchels, crossbody
- "jewelry": earrings, necklaces, bracelets, rings
- "fragrance": perfume, cologne, hair perfume, scents
- "femalefashionadvice": dresses, outfits, tops, skirts, African fashion, general

followup_type:
- "contextual": refers to previous results ("which is better?", "yes", "sure", "tell me more")
- "new_trend": new product category ("what about bags?", "show me jewelry trends")
- "action": sourcing/buying ("where do I buy?", "should I restock?")
- "general": no relation to history

plan rules — 3 to 5 short steps describing exactly what the agent will do:
- For trend queries: always include Google Trends search, Reddit sentiment check, Etsy market data, inventory match
- For product queries: always include inventory search step, Claude recommendation step
- For general/follow-up: describe what data from context will be used
- Steps should be specific to the keyword — mention "african print dress", "mesh mini dress" etc.
- Each step max 8 words, action-oriented, present tense
- Examples for trend query on "ankara dress":
  ["Search Google Trends for 'ankara dress' momentum",
   "Check r/femalefashionadvice for community sentiment",
   "Fetch Etsy market pricing and buyer reviews",
   "Search Busayo and Faire for sourcing options",
   "Match against Olive Mode inventory and generate insights"]

Respond with ONLY the JSON."""

        response = client.messages.create(
            model      = "claude-haiku-4-5-20251001",
            max_tokens = 200,
            messages   = [{"role": "user", "content": prompt}],
        )

        raw  = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)

        intent_str    = data.get("intent",        "general").lower()
        keyword       = data.get("keyword",       "").strip()
        subreddit     = data.get("subreddit",     "femalefashionadvice").strip()
        followup_type = data.get("followup_type", "general")
        reason        = data.get("reasoning",     "")
        plan          = data.get("plan",          [])

        print(f"[intent] '{message[:60]}' → intent={intent_str}, keyword='{keyword}', "
              f"followup={followup_type}, reason={reason}")

        intent = Intent(intent_str) if intent_str in Intent._value2member_map_ else Intent.GENERAL
        return intent, keyword, subreddit, reason, plan

    except Exception as e:
        print(f"[intent] Claude classification failed: {e}, falling back to GENERAL")
        return Intent.GENERAL, "", "femalefashionadvice", "", []