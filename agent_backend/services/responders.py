# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Responders
# File: services/responders.py
# ─────────────────────────────────────────────────────────────────────────────

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

        related     = pt.related_queries().get(keyword, {})
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

        # Rising searches with growth percentages
        def fmt_rising(r: dict) -> str:
            val = f"{r['value']:,}"
            return f"{r['query']} (+{val}%)"

        def fmt_top(q: dict) -> str:
            return f"{q['query']} ({q['value']})"

        rising_str = (
            f"\n\nRising searches: {', '.join(fmt_rising(r) for r in rising)}."
            if rising else ""
        )

        # Top related searches above 50 with scores
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

        return {
            "reply":  reply,
            "intent": intent,
            "source": "google_trends",
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
