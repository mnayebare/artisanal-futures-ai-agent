# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Responders
# File: services/responders.py
# ─────────────────────────────────────────────────────────────────────────────

import os
import anthropic

from services.intent import Intent
from services.pytrends_client import (
    get_pytrends,
    build_payload,
    interest_over_time,
    calculate_momentum,
    shape_related,
    clean_keyword,
    PLURALS,
)


# ─── Claude reasoning ─────────────────────────────────────────────────────────

def generate_trend_reasoning(
    keyword:     str,
    direction:   str,
    change_pct:  int,
    rising:      list[dict],
    top:         list[dict],
    spark_data:  list[int],
    spark_dates: list[str],
) -> str:
    """
    Ask Claude to interpret ALL Google Trends data and generate
    strategic insights for Olive Mode boutique.
    """
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        rising_str = "\n".join(
            f"  - {r['query']} (+{r['value']:,}% growth)"
            for r in rising
        ) if rising else "  - No rising queries available"

        top_str = "\n".join(
            f"  - {q['query']} (score: {q['value']}/100)"
            for q in top
        ) if top else "  - No top queries available"

        if spark_data and len(spark_data) >= 4:
            recent_avg  = sum(spark_data[-4:]) / 4
            earlier_avg = sum(spark_data[:4])  / 4
            peak        = max(spark_data)
            peak_date   = spark_dates[spark_data.index(peak)] if spark_dates else "unknown"
            spark_desc  = (
                f"Interest ranged from {min(spark_data)} to {peak} "
                f"(peak on {peak_date}). "
                f"Recent average: {recent_avg:.0f}, earlier average: {earlier_avg:.0f}."
            )
        else:
            spark_desc = "Limited data points available."

        prompt = f"""You are a fashion business analyst for Olive Mode, a Black-owned women's boutique in Detroit at the MBAD African Bead Museum.

Analyze ALL of this Google Trends data and provide strategic insights for the Olive Mode buyer:

KEYWORD: "{keyword}"
MOMENTUM: {direction} ({change_pct:+d}% change over last 4 weeks)
SEARCH PATTERN: {spark_desc}

RISING SEARCHES (fastest growing):
{rising_str}

TOP RELATED SEARCHES (highest volume):
{top_str}

Based on ALL of this data provide 3-4 concise insights covering:
1. What the overall trend pattern tells us about customer intent right now
2. What the top searches reveal about what customers actually want
3. What the rising searches signal about where demand is heading
4. One specific inventory or marketing action Olive Mode should take this week

Keep it under 150 words. Be direct, specific to Olive Mode's brand and customer base. Write in short paragraphs, no bullet points."""

        response = client.messages.create(
            model      = "claude-sonnet-4-6",
            max_tokens = 250,
            messages   = [{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    except Exception as e:
        print(f"[reasoning] Claude error: {e}")
        return ""


# ─── Trend handler ────────────────────────────────────────────────────────────

async def handle_trend_query(message: str, intent: Intent, platform: str | None = None) -> dict:
    """
    Fetches Google Trends data and returns reply + structured trend data
    including spark bar values with dates and top 10 related queries.
    """
    keyword = clean_keyword(message)
    print(f"[responder] trend keyword: '{message}' → '{keyword}'")

    try:
        pt = get_pytrends()
        build_payload(pt, [keyword], "today 3-m", "US")
        df = interest_over_time(pt)

        # Fallback to broader single word if no data
        if df.empty:
            last_word = keyword.split()[-1]
            fallback  = PLURALS.get(last_word, last_word)
            print(f"[responder] df empty for '{keyword}', trying fallback '{fallback}'")
            build_payload(pt, [fallback], "today 3-m", "US")
            df      = interest_over_time(pt)
            keyword = fallback

        related     = {}
        try:
            related = pt.related_queries().get(keyword, {})
            print(f"[responder] related keys: {list(related.keys())}")
            print(f"[responder] top type: {type(related.get('top'))}")
            print(f"[responder] top empty: {related.get('top') is None or (hasattr(related.get('top'), 'empty') and related.get('top').empty)}")
            if related.get("top") is not None and hasattr(related.get("top"), "head"):
                print(f"[responder] top sample:\n{related['top'].head()}")
        except Exception as e:
            print(f"[responder] related queries failed: {e}")

        rising      = shape_related(related.get("rising"))[:3]
        top_related = shape_related(related.get("top"))[:10]

        momentum    = calculate_momentum(df, [keyword])
        kw_momentum = momentum.get(keyword, {})
        change_pct  = kw_momentum.get("change_pct", 0)
        direction   = "up" if change_pct > 5 else "down" if change_pct < -5 else "flat"

        # Extract non-zero values + matching dates for spark bar
        if keyword in df.columns:
            all_rows    = [(str(date)[:10], int(val)) for date, val in df[keyword].items()]
            non_zero    = [(d, v) for d, v in all_rows if v > 0]
            spark_rows  = non_zero[-12:] if non_zero else all_rows[-12:]
            spark_data  = [v for _, v in spark_rows]
            spark_dates = [d for d, _ in spark_rows]
        else:
            spark_data  = []
            spark_dates = []

        # Build conversational reply
        if direction == "up":
            direction_phrase = f"up {change_pct}% recently — interest is growing"
        elif direction == "down":
            direction_phrase = f"down {abs(change_pct)}% recently"
        else:
            direction_phrase = "holding steady"

        def fmt_rising(r: dict) -> str:
            val = f"{r['value']:,}"
            return f"{r['query']} (+{val}%)"

        def fmt_top(q: dict) -> str:
            return f"{q['query']} ({q['value']})"

        rising_str = (
            f"\n\nRising searches: {', '.join(fmt_rising(r) for r in rising)}."
            if rising else ""
        )

        top_high = [q for q in top_related if q["value"] >= 50]
        top_str  = (
            f"\n\nTop related: {', '.join(fmt_top(q) for q in top_high)}."
            if top_high else ""
        )

        reply = (
            f"\"{keyword.title()}\" is {direction_phrase} on Google Trends."
            f"{rising_str}"
            f"{top_str}"
        )

        # Generate Claude reasoning from all trend data
        reasoning = generate_trend_reasoning(
            keyword     = keyword,
            direction   = direction,
            change_pct  = change_pct,
            rising      = rising,
            top         = top_related,
            spark_data  = spark_data,
            spark_dates = spark_dates,
        )

        return {
            "reply":     reply,
            "intent":    intent,
            "source":    "google_trends",
            "reasoning": reasoning,
            "trends": [
                {
                    "keyword":       keyword,
                    "is_trending":   direction == "up",
                    "weekly_counts": spark_data,
                    "dates":         spark_dates,
                    "prediction":    direction,
                    "rising":        rising,
                    "top":           top_related,
                }
            ],
        }

    except Exception as e:
        print(f"[responder] trend error: {e}")
        return {
            "reply":  f"I had trouble fetching trend data for \"{keyword}\" right now. Try again in a moment.",
            "intent": intent,
            "source": "google_trends",
            "trends": [],
        }


# ─── Product handler ──────────────────────────────────────────────────────────

async def handle_product_query(message: str, intent: Intent) -> dict:
    keyword = clean_keyword(message)
    return {
        "reply":    f"Let me find some options for \"{keyword}\" in the Olive Mode collection.",
        "intent":   intent,
        "source":   "database",
        "products": [],
    }


# ─── General handler ──────────────────────────────────────────────────────────

async def handle_general_query(message: str, intent: Intent, history: list[dict] | None = None) -> dict:
    from services.claude_client import run_agent
    result = await run_agent(message, history)
    return {
        "reply":        result["reply"],
        "intent":       intent,
        "source":       "claude",
        "tools_used":   result["tools_used"],
        "tool_results": result["tool_results"],
    }