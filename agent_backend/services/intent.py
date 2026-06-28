# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Intent Detection via Claude
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
    platform: str | None = None,
    history:  list[dict] | None = None,
) -> tuple[Intent, str, str, str, str]:
    """
    Use Claude Haiku to classify intent with full conversation context.
    Returns (intent, keyword, subreddit, best_platform) tuple.
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

                # Surface stored intent classification
                if intent_data and isinstance(intent_data, dict):
                    kw     = intent_data.get("keyword", "")
                    intent = intent_data.get("intent", "")
                    plat   = intent_data.get("best_platform", "")
                    rsn    = intent_data.get("reason", "")
                    if kw:
                        context_lines.append(
                            f"  [Classified as: intent={intent}, keyword='{kw}', platform={plat}"
                            + (f", reason={rsn}" if rsn else "") + "]"
                        )

                # Surface trend keywords from metadata
                elif trends and isinstance(trends, list):
                    kw = trends[0].get("keyword", "") if isinstance(trends[0], dict) else ""
                    if kw:
                        context_lines.append(f"  [Last trend keyword: '{kw}']")

            context_str = "\n".join(context_lines)

        prompt = f"""You are the routing intelligence for Olive Mode AI — a fashion trend research assistant for a Black-owned women's boutique in Detroit.

The user is the STORE OWNER or BUYER making inventory and sourcing decisions.

AVAILABLE APIS:
- Google Trends: Search volume, momentum, rising/falling interest, regional data
- Reddit (r/handbags, r/femalefashionadvice, r/jewelry, r/fragrance): Community opinions
- Etsy API: Market pricing, buyer reviews (automatic — no user selection)
- Tavily Web Search: FashionGo, Faire, Adjoaa, Mott the Label, Onuli + fashion media
- Olive Mode Database: Store's own inventory
- Pinterest: UNAVAILABLE

CURRENT PLATFORM: {platform or "none"}

RECENT CONVERSATION:
{context_str if context_str else "This is the first message"}

CURRENT MESSAGE: "{message}"

Classify this message considering the conversation context above.
Respond with ONLY a JSON object — no other text:

{{
  "intent": "trend" | "product" | "general" | "clarify",
  "keyword": "2-4 word search term",
  "subreddit": "femalefashionadvice" | "handbags" | "jewelry" | "fragrance",
  "best_platform": "google" | "reddit" | "either",
  "followup_type": "contextual" | "new_trend" | "action" | "general",
  "reasoning": "one sentence"
}}

Intent rules:
- "trend": researching market trends for ANY product — new or follow-up
  "what about bags?" after dress query → TREND for "bag"
  "KITSCH Amber Shores Hair Perfume" → TREND for "hair perfume"
  "what's trending?" → TREND, keyword from context if available
- "product": asking about OWN store inventory only
- "general": conversational — greetings, summaries, "which is better?" using existing data
- "clarify": genuinely ambiguous even with context

Keyword rules:
- Extract product category being asked about RIGHT NOW
- Follow-ups: "what about bags?" → "bag" (not from history)
- Contextual: "which should I stock?" → use last trend keyword from history
- Brand names → product type: "KITSCH Hair Perfume" → "hair perfume"
- 2-4 words max, no brand names

followup_type:
- "contextual": refers to previous results ("which is better?", "tell me more")
- "new_trend": new product category ("what about bags?", "show me jewelry")
- "action": sourcing/buying action ("where do I buy?", "should I restock?")
- "general": no relation to history

best_platform:
- "google": quantitative — volume, momentum, numbers
- "reddit": qualitative — opinions, sentiment, discussions
- "either": both work

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
        best_platform = data.get("best_platform", "either").strip()
        followup_type = data.get("followup_type", "general")
        reason        = data.get("reasoning",     "")

        print(f"[intent] '{message[:60]}' → intent={intent_str}, keyword='{keyword}', "
              f"followup={followup_type}, platform={best_platform}, "
              f"reason={reason}")

        intent = Intent(intent_str) if intent_str in Intent._value2member_map_ else Intent.GENERAL
        return intent, keyword, subreddit, best_platform, reason

    except Exception as e:
        print(f"[intent] Claude classification failed: {e}, falling back to GENERAL")
        return Intent.GENERAL, "", "femalefashionadvice", "either", ""