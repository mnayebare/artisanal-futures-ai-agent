# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Pinterest Router
# File: routers/pinterest.py
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import APIRouter, Query
from services.pinterest_client import pinterest_get

router = APIRouter(prefix="/pinterest", tags=["Pinterest"])


@router.get("/trends/top")
async def get_top_trends(
    region:               str  = Query(default="US"),
    trend_type:           str  = Query(default="monthly"),
    limit:                int  = Query(default=20, ge=1, le=50),
    include_predictions:  bool = Query(default=True),
    include_demographics: bool = Query(default=True),
    genders: str | None        = Query(default="female"),
    ages:    str | None        = Query(default=None),
):
    """Top trending keywords on Pinterest filtered to fashion & beauty."""
    params: dict = {
        "limit":            limit,
        "include_keywords": True,
    }
    if genders:              params["genders"]              = genders.split(",")
    if ages:                 params["ages"]                 = ages.split(",")
    if include_demographics: params["include_demographics"] = True

    data   = await pinterest_get(f"/trends/keywords/{region}/top/{trend_type}", params)
    trends = data.get("trends", [])

    return {
        "region":     region,
        "trend_type": trend_type,
        "filters": {
            "genders": genders.split(",") if genders else "all",
            "ages":    ages.split(",")    if ages    else "all",
        },
        "total":  len(trends),
        "trends": [
            {
                "keyword":       t.get("keyword"),
                "is_trending":   t.get("is_trending_now", False),
                "weekly_counts": t.get("weekly_counts", {}).get("adjusted_trend_counts", []),
                "prediction":    t.get("trend_prediction") if include_predictions else None,
                "demographics":  _extract_demographics(t) if include_demographics else None,
            }
            for t in trends
        ],
    }


@router.get("/trends/featured")
async def get_featured_topics(region: str = Query(default="US")):
    """Pinterest editorially curated featured trend topics."""
    data   = await pinterest_get("/trends/topics/featured", {"region": region})
    topics = data.get("items", [])
    return {
        "region": region,
        "total":  len(topics),
        "topics": [
            {
                "id":          t.get("id"),
                "name":        t.get("name"),
                "description": t.get("description"),
                "image_url":   t.get("image_url"),
                "trend_url":   t.get("trend_url"),
            }
            for t in topics
        ],
    }


@router.get("/trends/categories")
async def get_trending_categories(region: str = Query(default="US")):
    """Trending product categories on Pinterest."""
    data       = await pinterest_get("/trends/product_categories/trending", {"region": region})
    categories = data.get("items", [])
    return {
        "region": region,
        "total":  len(categories),
        "categories": [
            {
                "id":        c.get("id"),
                "name":      c.get("name"),
                "momentum":  c.get("trend_score"),
                "image_url": c.get("image_url"),
            }
            for c in categories
        ],
    }


@router.get("/trends/keyword/{keyword}")
async def get_keyword_trend(
    keyword:    str,
    region:     str = Query(default="US"),
    trend_type: str = Query(default="monthly"),
):
    """Trend data for a specific keyword."""
    data   = await pinterest_get(
        f"/trends/keywords/{region}/top/{trend_type}",
        {"limit": 50, "include_keywords": True}
    )
    trends        = data.get("trends", [])
    keyword_lower = keyword.lower()
    matches       = [t for t in trends if keyword_lower in t.get("keyword", "").lower()]

    if not matches:
        return {
            "keyword": keyword,
            "region":  region,
            "found":   False,
            "message": f"'{keyword}' not found in top {trend_type} trends for {region}.",
            "trends":  [],
        }

    return {
        "keyword": keyword,
        "region":  region,
        "found":   True,
        "total":   len(matches),
        "trends": [
            {
                "keyword":       t.get("keyword"),
                "is_trending":   t.get("is_trending_now", False),
                "weekly_counts": t.get("weekly_counts", {}).get("adjusted_trend_counts", []),
                "prediction":    t.get("trend_prediction"),
            }
            for t in matches
        ],
    }


# ─── Helper ───────────────────────────────────────────────────────────────────

def _extract_demographics(trend: dict) -> dict:
    demo = trend.get("demographics", {})
    if not demo:
        return {}
    return {
        "ages": {
            b.get("name"): f"{round(b.get('ratio', 0) * 100, 1)}%"
            for b in demo.get("ages", [])
        },
        "genders": {
            b.get("name"): f"{round(b.get('ratio', 0) * 100, 1)}%"
            for b in demo.get("genders", [])
        },
    }