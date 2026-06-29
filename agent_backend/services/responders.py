# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Responders
# File: services/responders.py
# ─────────────────────────────────────────────────────────────────────────────

import os
import anthropic

from services.intent import Intent
from services import db_service
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
    products:    list[dict],
    etsy_data:   dict = {},
) -> str:
    """
    Ask Claude to interpret ALL Google Trends data AND the actual
    Olive Mode product inventory to generate actionable insights.
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

        # Format Olive Mode inventory
        if products:
            products_str = "\n".join(
                f"  - {p['productName']} ({p['category']}) — ${p['price']}"
                f"{' | ' + p['tag'] if p.get('tag') else ''}"
                f"{' | ' + p['material'] if p.get('material') else ''}"
                for p in products
            )
        else:
            products_str = "  - No matching products currently in inventory"

        # Format Etsy market data
        etsy_summary  = etsy_data.get("summary", {})
        etsy_reviews  = etsy_data.get("reviews", [])

        if etsy_summary.get("avg_price"):
            etsy_market_str = (
                f"  Price range: {etsy_summary.get('price_range', 'N/A')}\n"
                f"  Total views: {etsy_summary.get('total_views', 0):,}\n"
                f"  Total favorites: {etsy_summary.get('total_favs', 0):,}\n"
                f"  Avg rating: {etsy_summary.get('avg_rating', 0)}/5 "
                f"({etsy_summary.get('review_count', 0)} reviews)"
            )
        else:
            etsy_market_str = "  Etsy market data unavailable"

        etsy_reviews_str = ""
        if etsy_reviews:
            etsy_reviews_str = "\n\nETSY BUYER REVIEWS:\n"
            for r in etsy_reviews[:6]:
                stars  = "★" * r.get("rating", 0) + "☆" * (5 - r.get("rating", 0))
                review = r.get("review", "")[:200]
                title  = r.get("listing_title", "")[:50]
                etsy_reviews_str += f"  {stars} [{title}]: \"{review}\"\n"

        prompt = f"""You are a fashion business analyst for Olive Mode, a Black-owned women's boutique in Detroit at the MBAD African Bead Museum.

Analyze ALL of this data and provide strategic insights for the Olive Mode buyer:

KEYWORD: "{keyword}"
MOMENTUM: {direction} ({change_pct:+d}% change over last 4 weeks)
SEARCH PATTERN: {spark_desc}

RISING SEARCHES (fastest growing):
{rising_str}

TOP RELATED SEARCHES (highest volume):
{top_str}

ETSY MARKET DATA (similar products selling right now):
{etsy_market_str}
{etsy_reviews_str}
OLIVE MODE INVENTORY:
{products_str}

Provide analysis in exactly these three sections. Keep the total under 220 words.

**Merchandising & Buying**
How deep should Olive Mode invest in this trend? Reference the momentum data, Etsy price range, and current inventory gaps. Name specific products to restock, reprice, or source.

**Marketing & PR**
Which rising search terms and aesthetics should Olive Mode align their Instagram, TikTok and email storytelling with right now to capture immediate search traffic? Reference actual rising queries and top searches. Then write a suggested post recommendation — label it clearly as "Suggested [Platform] Post:", include the full caption copy with hashtags, and describe the visual or video concept in one sentence.

**Best Strategy for Current Inventory**
For each matching product in Olive Mode's inventory, what is the optimal move — feature it, bundle it, discount it, or hold? Be specific with product names and prices.

Write in short paragraphs. No bullet points."""

        response = client.messages.create(
            model      = "claude-sonnet-4-6",
            max_tokens = 600,
            messages   = [{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    except Exception as e:
        print(f"[reasoning] Claude error: {e}")
        return ""


# ─── Trend handler ────────────────────────────────────────────────────────────

async def handle_trend_query(message: str, intent: Intent, platform: str | None = None, keyword: str = "") -> dict:
    """
    Called when user asks about trends.
    keyword is pre-extracted by Claude intent classifier.
    """
    if not keyword:
        keyword = clean_keyword(message)
    print(f"[responder] trend keyword: '{keyword}'")

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

        related         = {}
        related_limited = False
        try:
            related = pt.related_queries().get(keyword, {})
            print(f"[responder] related keys: {list(related.keys())}")
        except Exception as e:
            print(f"[responder] related queries failed: {e}")
            related_limited = True

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

        # Fetch Etsy market data
        etsy_data = {}
        try:
            from routers.etsy import get_etsy_insights
            print(f"[responder] fetching etsy insights for '{keyword}'")
            etsy_data = await get_etsy_insights(keyword=keyword, listings=5, reviews=5)
            summary   = etsy_data.get("summary", {})
            print(f"[responder] etsy: {summary.get('review_count', 0)} reviews, "
                  f"price {summary.get('price_range', 'N/A')}, "
                  f"{summary.get('total_favs', 0)} favorites")
        except Exception as e:
            print(f"[responder] etsy insights failed: {e}")

        # Search the web for each rising query — skip if rate limited
        rising_links = []
        if not related_limited and rising:
            try:
                from routers.websearch import search_supplier_products, search_media_coverage
                for r in rising[:3]:
                    try:
                        print(f"[websearch] searching for '{r['query']}'")

                        # Extract product keyword for supplier search
                        words         = r["query"].lower().split()
                        product_words = [w for w in words if w in [
                            "dress", "bag", "purse", "clutch", "earring", "necklace",
                            "bracelet", "perfume", "skirt", "top", "jumpsuit", "romper",
                            "midi", "maxi", "mini", "bandage", "mesh", "floral", "wrap",
                            "off-shoulder", "bodycon", "satin", "lace", "velvet", "knit",
                            "crossbody", "tote", "satchel", "hobo", "shoulder", "vintage",
                            "sequin", "beaded", "printed", "ruched", "plunge", "cutout",
                        ]]
                        supplier_query = " ".join(product_words) if product_words else keyword

                        supplier_results = await search_supplier_products(supplier_query, max_results=5)
                        print(f"[websearch] supplier results for '{supplier_query}': {len(supplier_results)}")

                        media_results = await search_media_coverage(r["query"], max_results=3)
                        print(f"[websearch] media results for '{r['query']}': {len(media_results)}")

                        for res in supplier_results + media_results:
                            print(f"  → [{res['source']}] {res['title']}")
                            rising_links.append({
                                "query":       r["query"],
                                "growth":      r["value"],
                                "title":       res["title"],
                                "url":         res["url"],
                                "snippet":     res["snippet"],
                                "source":      res["source"],
                                "is_supplier": res.get("is_supplier", False),
                            })
                    except Exception as e:
                        print(f"[websearch] failed for '{r['query']}': {e}")
                print(f"[websearch] total rising links: {len(rising_links)}")
            except Exception as e:
                print(f"[websearch] import/setup failed: {e}")

        etsy_data["rising_links"] = rising_links

        # Search Olive Mode inventory
        try:
            products = await db_service.search_products(keyword=keyword, limit=8)
            print(f"[responder] found {len(products)} matching products for '{keyword}'")
        except Exception as e:
            print(f"[responder] product search failed: {e}")
            products = []

        # Build reply with rising search links from Etsy
        rising_links = etsy_data.get("rising_links", [])
        if rising_links:
            from collections import defaultdict
            grouped: dict    = defaultdict(list)
            growth_map: dict = {}
            for link in rising_links:
                grouped[link["query"]].append(link)
                growth_map[link["query"]] = link["growth"]

            rising_parts = []
            for query, links in grouped.items():
                growth    = growth_map[query]
                suppliers = [l for l in links if l.get("is_supplier")]
                media     = [l for l in links if not l.get("is_supplier")]
                rising_parts.append(f"{query} (+{growth:,}%)")
                if suppliers:
                    rising_parts.append("  Shop:")
                    for l in suppliers[:3]:
                        rising_parts.append(f"    → [{l['title'][:55]}]({l['url']})")
                if media:
                    rising_parts.append("  Coverage:")
                    for l in media[:2]:
                        rising_parts.append(f"    → [{l['title'][:55]}]({l['url']})")

            rising_reply = "\n".join(
                f"• {p}" if not p.startswith("  ") else p
                for p in rising_parts
            )
        else:
            rising_reply = "\n".join(fmt_rising(r) for r in rising)

        top_high      = [q for q in top_related if q["value"] >= 50]
        top_str_reply = ", ".join(fmt_top(q) for q in top_high)

        rate_limit_note = (
            "\n\n⚠️ Top & rising searches are temporarily unavailable "
            "(Google Trends rate limit). Momentum and spark data are still shown."
        ) if related_limited else ""

        reply = (
            f"\"{keyword.title()}\" is {direction_phrase} on Google Trends.\n\n"
            + (f"Rising searches:\n{rising_reply}\n\n" if rising_reply else "")
            + (f"Top related: {top_str_reply}." if top_str_reply else "")
            + rate_limit_note
        )

        # Generate Claude reasoning from trend data + inventory
        reasoning = generate_trend_reasoning(
            keyword     = keyword,
            direction   = direction,
            change_pct  = change_pct,
            rising      = rising,
            top         = top_related,
            spark_data  = spark_data,
            spark_dates = spark_dates,
            products    = products,
            etsy_data   = etsy_data,
        )

        return {
            "reply":     reply,
            "intent":    intent,
            "source":    "google_trends",
            "reasoning": reasoning,
            "products": [
                {
                    "id":       str(p["id"]),
                    "name":     p["productName"],
                    "category": p["category"],
                    "price":    float(p["price"]),
                    "inStock":  p["inStock"],
                    "imageUrl": p.get("imageUrl"),
                }
                for p in products
            ] if products else None,
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
        err_str = str(e)
        print(f"[responder] trend error: {e}")

        # On rate limit — still run Etsy + product search and generate reasoning
        if "429" in err_str or "Max retries" in err_str:
            try:
                products = await db_service.search_products(keyword=keyword, limit=8)
                etsy_data = {}
                try:
                    from routers.etsy import get_etsy_insights
                    etsy_data = await get_etsy_insights(keyword=keyword, listings=5, reviews=5)
                except Exception:
                    pass

                reasoning = generate_trend_reasoning(
                    keyword     = keyword,
                    direction   = "unknown",
                    change_pct  = 0,
                    rising      = [],
                    top         = [],
                    spark_data  = [],
                    spark_dates = [],
                    products    = products,
                    etsy_data   = etsy_data,
                )

                return {
                    "reply":     (
                        f"⚠️ Google Trends is temporarily rate-limited for \"{keyword}\". "
                        f"I've pulled Etsy market data and matched your inventory instead. "
                        f"Try again in a few minutes for full trend momentum data."
                    ),
                    "intent":    intent,
                    "source":    "google_trends",
                    "reasoning": reasoning,
                    "trends":    [],
                }
            except Exception as e2:
                print(f"[responder] fallback also failed: {e2}")

        return {
            "reply":  f"I had trouble fetching trend data for \"{keyword}\" right now. Try again in a moment.",
            "intent": intent,
            "source": "google_trends",
            "trends": [],
        }


# ─── Reddit handler ───────────────────────────────────────────────────────────

async def handle_reddit_query(message: str, intent: Intent, keyword: str = "", subreddit: str = "") -> dict:
    """
    Called when user selects Reddit as the platform.
    keyword and subreddit are pre-determined by Claude intent classifier.
    """
    from routers.reddit import select_subreddits, fetch_subreddit_posts, fetch_post_comments
    import anthropic, os

    if not keyword:
        keyword = clean_keyword(message)

    # Use Claude-selected subreddit or fall back to keyword-based selection
    subreddits = [subreddit] if subreddit else select_subreddits(keyword)
    print(f"[responder] reddit keyword='{keyword}' subreddits={subreddits}")

    try:
        # Fetch posts from selected subreddits
        all_posts = []
        for sub in subreddits:
            try:
                posts = await fetch_subreddit_posts(sub, keyword, limit=8)
                print(f"[reddit] r/{sub} returned {len(posts)} posts for '{keyword}'")

                # Broaden keyword if no results
                if not posts:
                    words   = keyword.split()
                    broader = " ".join(words[-2:]) if len(words) > 2 else " ".join(words[-1:])
                    print(f"[reddit] broadening '{keyword}' → '{broader}'")
                    posts = await fetch_subreddit_posts(sub, broader, limit=8)
                    print(f"[reddit] r/{sub} returned {len(posts)} posts for '{broader}'")

                # Final fallback — try just the category word
                if not posts:
                    for cat in ["dress", "bag", "perfume", "jewelry", "earring",
                                "necklace", "bracelet", "clutch", "crossbody", "scent",
                                "ankara", "african"]:
                        if cat in keyword.lower():
                            print(f"[reddit] category fallback '{cat}'")
                            posts = await fetch_subreddit_posts(sub, cat, limit=8)
                            if posts:
                                break

                for p in posts:
                    print(f"  - '{p['title']}' (score={p['score']}, comments={p['comments']})")
                for post in posts:
                    post["subreddit"] = sub
                all_posts.extend(posts)
            except Exception as e:
                print(f"[reddit] r/{sub} error: {e}")

        all_posts.sort(key=lambda p: p["score"], reverse=True)
        top_posts = all_posts[:6]

        # Fetch comments for top 3 posts
        for post in top_posts[:3]:
            try:
                permalink = post["url"].replace("https://reddit.com", "")
                post["top_comments"] = await fetch_post_comments(permalink, limit=5)
            except Exception:
                post["top_comments"] = []

        if not top_posts:
            return {
                "reply":  f"I couldn't find relevant Reddit discussions for \"{keyword}\" right now. Try Google Trends instead.",
                "intent": intent,
                "source": "reddit",
            }

        # Fetch Etsy market data alongside Reddit posts
        etsy_data = {}
        try:
            from routers.etsy import get_etsy_insights
            etsy_data = await get_etsy_insights(keyword=keyword, listings=5, reviews=5)
            summary   = etsy_data.get("summary", {})
            print(f"[responder] etsy: {summary.get('review_count', 0)} reviews, "
                  f"price range {summary.get('price_range', 'N/A')}")
        except Exception as e:
            print(f"[responder] etsy insights failed: {e}")

        # Search Olive Mode inventory for matching products
        try:
            products = await db_service.search_products(keyword=keyword, limit=8)
        except Exception:
            products = []

        # Build context for Claude — summarise what users are saying
        posts_context = ""
        for post in top_posts:
            posts_context += f"\nPOST: \"{post['title']}\" (score: {post['score']}, {post['comments']} comments)"
            if post.get("text"):
                posts_context += f"\n  Body: {post['text'][:300]}"
            if post.get("top_comments"):
                posts_context += "\n  Top comments:"
                for comment in post["top_comments"][:3]:
                    posts_context += f"\n    - {comment[:250]}"

        products_str = "\n".join(
            f"  - {p['productName']} ({p['category']}) — ${p['price']}"
            f"{' | ' + p['tag'] if p.get('tag') else ''}"
            for p in products
        ) if products else "  - No matching products in current inventory"

        # Format Etsy data
        etsy_summary = etsy_data.get("summary", {})
        etsy_reviews = etsy_data.get("reviews", [])
        etsy_str     = ""
        if etsy_summary.get("avg_price"):
            etsy_str = (
                f"\n\nETSY MARKET DATA (similar products):\n"
                f"  Price range: {etsy_summary.get('price_range', 'N/A')} | "
                f"Avg rating: {etsy_summary.get('avg_rating', 0)}/5 | "
                f"Favorites: {etsy_summary.get('total_favs', 0):,}\n"
            )
            if etsy_reviews:
                etsy_str += "  Buyer reviews: " + " | ".join(
                    f"{'★' * r.get('rating', 0)} \"{r.get('review', '')[:100]}\""
                    for r in etsy_reviews[:3]
                )

        prompt = f"""You are a fashion business analyst for Olive Mode, a Black-owned women's boutique in Detroit at the MBAD African Bead Museum.

Analyze what Reddit users are saying about "{keyword}" in r/{', r/'.join(subreddits)} alongside Etsy market data and Olive Mode's inventory:

REDDIT DISCUSSIONS:
{posts_context}
{etsy_str}
OLIVE MODE INVENTORY:
{products_str}

Provide analysis in exactly these three sections. Keep total under 220 words.

**Merchandising & Buying**
Based on Reddit community sentiment and Etsy market data, how deep should Olive Mode invest in this category? What price points are Reddit users comfortable with? What specific styles or features do they demand? Name any inventory gaps.

**Marketing & PR**
What language, aesthetics and occasions are Reddit users using when they talk about this product? How should Olive Mode align their Instagram, TikTok and email copy with these exact words and sentiments to capture this community's attention? Then write a suggested post recommendation — label it clearly as "Suggested [Platform] Post:", include the full caption copy with hashtags, and describe the visual or video concept in one sentence.

**Best Strategy for Current Inventory**
For each matching product in Olive Mode's inventory, what is the optimal move based on this Reddit and Etsy intelligence — feature it, bundle it, reprice it, or hold? Be specific with product names and prices.

Write in short paragraphs. No bullet points."""

        client   = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model      = "claude-sonnet-4-6",
            max_tokens = 350,
            messages   = [{"role": "user", "content": prompt}],
        )
        reasoning = response.content[0].text.strip()

        # Build reply with post titles as hyperlinks only
        subreddit_names = ", ".join(f"r/{s}" for s in subreddits)
        posts_lines     = "\n".join(
            f"• [{p['title']}]({p['url']}) {p['comments']} comments"
            for p in top_posts
        )

        reply = (
            f"Found {len(top_posts)} discussions about \"{keyword}\" on {subreddit_names}:\n\n"
            f"{posts_lines}\n\n"
            f"Full analysis is in the reasoning panel."
        )

        return {
            "reply":     reply,
            "intent":    intent,
            "source":    "reddit",
            "reasoning": reasoning,
            "reddit_posts": [
                {
                    "title":     p["title"],
                    "url":       p["url"],
                    "comments":  p["comments"],
                    "score":     p["score"],
                    "subreddit": p["subreddit"],
                }
                for p in top_posts
            ],
            "products": [
                {
                    "id":       str(p["id"]),
                    "name":     p["productName"],
                    "category": p["category"],
                    "price":    float(p["price"]),
                    "inStock":  p["inStock"],
                    "imageUrl": p.get("imageUrl"),
                }
                for p in products
            ] if products else None,
        }

    except Exception as e:
        print(f"[responder] reddit error: {e}")
        return {
            "reply":  f"I had trouble reading Reddit right now. Try again in a moment.",
            "intent": intent,
            "source": "reddit",
        }

async def handle_product_query(message: str, intent: Intent, keyword: str = "") -> dict:
    """
    Searches Olive Mode's product database and returns matching products
    with a Claude-generated recommendation based on the query.
    """
    import anthropic, os

    if not keyword:
        keyword = clean_keyword(message)

    # Search the database — try keyword first, then category fallback
    try:
        products = await db_service.search_products(keyword=keyword, limit=20)
        print(f"[responder] product query '{keyword}' → {len(products)} results")

        # If no results, try searching by just the category word
        if not products:
            category_words = ["dress", "bag", "jewelry", "perfume", "top", "skirt",
                              "jumpsuit", "clutch", "crossbody", "earring", "bracelet",
                              "necklace", "ring", "beauty", "set"]
            for cat in category_words:
                if cat in keyword.lower():
                    products = await db_service.search_products(keyword=cat, limit=20)
                    print(f"[responder] category fallback '{cat}' → {len(products)} results")
                    if products:
                        break
    except Exception as e:
        print(f"[responder] product search failed: {e}")
        products = []

    if not products:
        return {
            "reply":  f"I searched the Olive Mode inventory for \"{keyword}\" but couldn't find any matching products. Try a broader term like \"dress\", \"bag\" or \"jewelry\".",
            "intent": intent,
            "source": "database",
        }

    # Format product list for Claude
    products_str = "\n".join(
        f"  - {p['productName']} ({p['category']}) — ${p['price']}"
        f"{' | ' + p['tag'] if p.get('tag') else ''}"
        f"{' | ' + p['material'] if p.get('material') else ''}"
        for p in products
    )

    # Ask Claude to answer the question with existence confirmation first
    try:
        client  = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        prompt  = f"""You are Olive Mode AI — assistant for a Black-owned women's boutique in Detroit.

The owner asked: "{message}"

Here are the matching products found in the Olive Mode database:
{products_str}

Answer in this order:
1. FIRST — directly confirm whether the product exists in the database. Start with "Yes, [product name] is in your inventory" or "I couldn't find [product name] in the database."
2. THEN — if found, give the price, category and any relevant details
3. FINALLY — if they asked for a recommendation (e.g. top 3 for summer), provide that

Keep it under 120 words. Be direct and specific with product names and prices."""

        response = client.messages.create(
            model      = "claude-sonnet-4-6",
            max_tokens = 250,
            messages   = [{"role": "user", "content": prompt}],
        )
        reply = response.content[0].text.strip()
    except Exception as e:
        print(f"[responder] product Claude response failed: {e}")
        reply = f"Found {len(products)} products matching \"{keyword}\" in the Olive Mode collection."

    return {
        "reply":    reply + (
            f"\n\nWant me to research how \"{keyword}\" is trending on Google Trends and Reddit?"
            if products else ""
        ),
        "intent":   intent,
        "source":   "database",
        "products": [
            {
                "id":       str(p["id"]),
                "name":     p["productName"],
                "category": p["category"],
                "price":    float(p["price"]),
                "inStock":  p["inStock"],
                "imageUrl": p.get("imageUrl"),
            }
            for p in products
        ],
    }


# ─── General handler ──────────────────────────────────────────────────────────

async def handle_general_query(message: str, intent: Intent, history: list[dict] | None = None) -> dict:
    """
    Handles conversational follow-ups using full chat history as context.
    Fetches live product inventory to inject into Claude's system prompt.
    """
    import anthropic, os

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Fetch live product inventory from database
    try:
        all_products = await db_service.search_products(limit=50)
        products_str = "\n".join(
            f"   - {p['productName']} ({p['category']}) — ${p['price']}"
            f"{' | ' + p['tag'] if p.get('tag') else ''}"
            f"{' | material: ' + p['material'] if p.get('material') else ''}"
            for p in all_products
        ) if all_products else "   - No products in inventory yet"
    except Exception as e:
        print(f"[general] product fetch failed: {e}")
        products_str = "   - Unable to fetch inventory right now"

    system = f"""You are Olive Mode AI — a fashion trend research assistant for a Black-owned women's boutique in Detroit at the MBAD African Bead Museum.

You help the store owner and buyer with trend research, sourcing, and inventory decisions.

OLIVE MODE CURRENT INVENTORY (live from database):
{products_str}

TOOLS YOU HAVE ACCESS TO:
- Google Trends: Search volume, momentum, rising/falling interest, regional data
- Reddit: r/handbags, r/femalefashionadvice, r/jewelry, r/fragrance — community opinions
- Etsy: Market pricing and buyer reviews (runs automatically in background)
- Web Search: FashionGo, Faire, Adjoaa, Mott the Label, Onuli, Busayo, D'IYANU, Africa Imports + Vogue, Elle, Harper's Bazaar
- Olive Mode Database: The product inventory listed above — you have full access right now
- Pinterest: UNAVAILABLE — pending API approval

CRITICAL BEHAVIOUR RULES:
- READ YOUR PREVIOUS MESSAGE carefully before responding. If you asked a question and the owner answered it (even with just "yes", "no", "sure", "please"), ANSWER WHAT YOU OFFERED — don't ask another clarifying question.
- "yes" after you offered help = proceed with what you offered
- "no" after you offered something = acknowledge and ask what they'd prefer instead
- When asked about inventory → reference actual products listed above by name and price
- For new product categories → suggest running a Google or Reddit trend search
- Be concise and direct — concrete recommendations with actual product names
- NEVER say you don't have database access — you DO have the inventory listed above
- For sourcing questions → mention FashionGo, Faire, Adjoaa, Mott the Label, Onuli, Busayo, D'IYANU
- Keep responses under 150 words — no markdown tables, no bullet point overload"""

    # Build messages with full history including structured results
    # Cap history to last 12 messages — enough context without bloating the prompt
    recent_history = (history or [])[-12:]

    # Build messages with full history — properly attributed
    messages = []
    if recent_history:
        for msg in recent_history:
            role    = "user" if msg.get("role") == "user" else "assistant"
            content = msg.get("text", "")

            # Enrich assistant messages with structured context
            metadata = msg.get("metadata") or {}
            if role == "assistant" and metadata:
                reasoning = metadata.get("reasoning", "")
                trends    = metadata.get("trends", [])
                intent    = (metadata.get("intent_data") or {}).get("keyword", "")
                if reasoning:
                    content += f"\n\n[My previous analysis: {reasoning[:400]}]"
                if trends and isinstance(trends, list) and trends:
                    t         = trends[0] if isinstance(trends[0], dict) else {}
                    kw        = t.get("keyword", "")
                    direction = t.get("prediction", "")
                    rising    = [r["query"] for r in t.get("rising", [])[:3] if isinstance(r, dict)]
                    if kw:
                        content += f"\n[Trend data I retrieved: '{kw}' is {direction}, rising: {', '.join(rising)}]"
                elif intent:
                    content += f"\n[Topic I was helping with: '{intent}']"

            messages.append({"role": role, "content": content})

    # Add current message
    messages.append({"role": "user", "content": message})

    response = client.messages.create(
        model      = "claude-sonnet-4-6",
        max_tokens = 400,
        system     = system,
        messages   = messages,
    )

    return {
        "reply":  response.content[0].text.strip(),
        "intent": intent,
        "source": "claude",
    }