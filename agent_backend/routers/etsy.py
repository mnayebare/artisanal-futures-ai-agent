# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Etsy Router
# File: routers/etsy.py
#
# Searches Etsy marketplace for similar products and fetches buyer reviews.
# Uses Etsy Open API v3 — only requires API key for public endpoints.
#
# Add to .env:
#   ETSY_API_KEY=your_keystring
#
# Register at: https://www.etsy.com/developers/your-apps
# ─────────────────────────────────────────────────────────────────────────────

import os
import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/etsy", tags=["Etsy"])

ETSY_BASE = "https://api.etsy.com/v3/application"


def etsy_headers() -> dict:
    api_key = os.getenv("ETSY_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="ETSY_API_KEY not set in environment variables."
        )
    return {
        "x-api-key":    api_key,
        "Content-Type": "application/json",
    }


async def etsy_get(path: str, params: dict = {}) -> dict:
    """Make an authenticated GET request to the Etsy API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ETSY_BASE}{path}",
            headers=etsy_headers(),
            params=params,
            timeout=10.0,
        )
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="Etsy rate limit hit.")
        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Etsy API key invalid.")
        if not response.is_success:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Etsy API error: {response.text[:200]}"
            )
        return response.json()


# ─── Search listings ──────────────────────────────────────────────────────────

@router.get("/search")
async def search_etsy_listings(
    keyword:   str = Query(description="Fashion keyword to search for"),
    limit:     int = Query(default=5, ge=1, le=25),
    min_price: float | None = Query(default=None),
    max_price: float | None = Query(default=None),
):
    """
    Search Etsy active listings by keyword.
    Returns listings with prices, views, favorites — market demand signals.
    """
    params: dict = {
        "keywords":       keyword,
        "limit":          limit,
        "includes":       ["Images", "MainImage"],
        "sort_on":        "score",
        "sort_order":     "desc",
    }
    if min_price:
        params["min_price"] = min_price
    if max_price:
        params["max_price"] = max_price

    data     = await etsy_get("/listings/active", params)
    listings = data.get("results", [])

    return {
        "keyword": keyword,
        "total":   data.get("count", 0),
        "listings": [
            {
                "listing_id":  l.get("listing_id"),
                "title":       l.get("title", ""),
                "price":       l.get("price", {}).get("amount", 0) / 100,
                "currency":    l.get("price", {}).get("currency_code", "USD"),
                "url":         l.get("url", ""),
                "views":       l.get("views", 0),
                "favorites":   l.get("num_favorers", 0),
                "tags":        l.get("tags", []),
                "image_url":   (
                    l.get("MainImage", {}).get("url_570xN")
                    or l.get("MainImage", {}).get("url_fullxfull")
                ),
            }
            for l in listings
        ],
    }


# ─── Fetch reviews ────────────────────────────────────────────────────────────

@router.get("/reviews/{listing_id}")
async def get_listing_reviews(
    listing_id: int,
    limit:      int = Query(default=10, ge=1, le=25),
):
    """
    Fetch buyer reviews for a specific Etsy listing.
    Returns rating, review text and date.
    """
    data    = await etsy_get(f"/listings/{listing_id}/reviews", {"limit": limit})
    reviews = data.get("results", [])

    return {
        "listing_id": listing_id,
        "total":      data.get("count", 0),
        "reviews": [
            {
                "rating":   r.get("rating"),
                "review":   r.get("review", ""),
                "created":  r.get("create_timestamp", 0),
            }
            for r in reviews
            if r.get("review")  # skip reviews with no text
        ],
    }


# ─── Combined search + reviews ────────────────────────────────────────────────

@router.get("/insights")
async def get_etsy_insights(
    keyword:   str = Query(description="Fashion keyword"),
    listings:  int = Query(default=5,  ge=1, le=10),
    reviews:   int = Query(default=5,  ge=1, le=10),
):
    """
    Combined endpoint — searches listings then fetches reviews for each.
    Returns market pricing, demand signals and buyer sentiment in one call.
    Used by the trend reasoning engine.
    """
    # Step 1 — search listings
    search_data = await search_etsy_listings(keyword=keyword, limit=listings)
    top_listings = search_data.get("listings", [])

    if not top_listings:
        return {
            "keyword":  keyword,
            "listings": [],
            "reviews":  [],
            "summary": {
                "avg_price":     0,
                "price_range":   "",
                "total_views":   0,
                "total_favs":    0,
                "review_count":  0,
                "avg_rating":    0,
            }
        }

    # Step 2 — fetch reviews for top 3 listings
    all_reviews = []
    for listing in top_listings[:3]:
        lid = listing.get("listing_id")
        if not lid:
            continue
        try:
            review_data = await get_listing_reviews(listing_id=lid, limit=reviews)
            for r in review_data.get("reviews", []):
                r["listing_title"] = listing.get("title", "")
                r["listing_price"] = listing.get("price", 0)
                all_reviews.append(r)
        except Exception as e:
            print(f"[etsy] reviews error for listing {lid}: {e}")

    # Step 3 — compute summary stats
    prices     = [l["price"] for l in top_listings if l.get("price")]
    ratings    = [r["rating"] for r in all_reviews if r.get("rating")]

    summary = {
        "avg_price":    round(sum(prices) / len(prices), 2) if prices else 0,
        "price_range":  f"${min(prices):.0f}–${max(prices):.0f}" if prices else "",
        "total_views":  sum(l.get("views", 0)     for l in top_listings),
        "total_favs":   sum(l.get("favorites", 0) for l in top_listings),
        "review_count": len(all_reviews),
        "avg_rating":   round(sum(ratings) / len(ratings), 1) if ratings else 0,
    }

    return {
        "keyword":  keyword,
        "listings": top_listings,
        "reviews":  all_reviews,
        "summary":  summary,
    }