# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Google Trends Router
# File: routers/google.py
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import APIRouter, HTTPException, Query
from services.pytrends_client import (
    get_pytrends,
    build_payload,
    interest_over_time,
    calculate_momentum,
    shape_related,
    clean_keyword,
)

router = APIRouter(prefix="/google", tags=["Google Trends"])

# Olive Mode's core product categories for comparison
OLIVE_MODE_CATEGORIES = [
    "mini dress",
    "midi dress",
    "crossbody bag",
    "summer jewelry",
    "hair perfume",
]


@router.get("/trends/keyword")
async def google_keyword_trend(
    keywords:  str = Query(description="Comma-separated keywords, max 5"),
    timeframe: str = Query(default="today 3-m"),
    geo:       str = Query(default="US"),
    category:  int = Query(default=185, description="185 = Fashion & Style"),
):
    """Interest over time for up to 5 keywords with momentum calculation."""
    try:
        raw_list = [k.strip() for k in keywords.split(",")][:5]
        kw_list  = [clean_keyword(k) for k in raw_list]
        print(f"[google] keywords cleaned: {raw_list} → {kw_list}")
        pt       = get_pytrends()
        build_payload(pt, kw_list, timeframe, geo, category)
        df       = interest_over_time(pt)

        if df.empty:
            return {"keywords": kw_list, "timeframe": timeframe, "geo": geo, "found": False, "data": []}

        # Only return data points with non-zero values
        data = [
            {"date": str(date)[:10], "values": {kw: int(row[kw]) for kw in kw_list if kw in row}}
            for date, row in df.iterrows()
            if any(int(row[kw]) > 0 for kw in kw_list if kw in row)
        ]

        return {
            "keywords":  kw_list,
            "timeframe": timeframe,
            "geo":       geo,
            "found":     True,
            "momentum":  calculate_momentum(df, kw_list),
            "data":      data,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[google] keyword endpoint error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Google Trends error: {str(e)}")


@router.get("/trends/related")
async def google_related_queries(
    keyword: str = Query(description="Single keyword"),
    geo:     str = Query(default="US"),
):
    """Rising and top related queries — rising list shows early trend signals."""
    try:
        clean = clean_keyword(keyword)
        print(f"[google] related cleaned: '{keyword}' → '{clean}'")
        pt      = get_pytrends()
        build_payload(pt, [clean], "today 3-m", geo)
        related = pt.related_queries()
        result  = related.get(clean, {})

        return {
            "keyword": clean,
            "geo":     geo,
            "rising":  shape_related(result.get("rising")),
            "top":     shape_related(result.get("top")),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Trends error: {str(e)}")


@router.get("/trends/regional")
async def google_regional_interest(
    keyword:    str = Query(description="Keyword to check"),
    geo:        str = Query(default="US"),
    resolution: str = Query(default="REGION", description="REGION | DMA | CITY"),
):
    """Geographic breakdown — which states or cities are searching most."""
    try:
        clean = clean_keyword(keyword)
        print(f"[google] regional cleaned: '{keyword}' → '{clean}'")
        pt = get_pytrends()
        build_payload(pt, [clean], "today 3-m", geo)
        df = pt.interest_by_region(resolution=resolution, inc_low_vol=False, inc_geo_code=False)

        if df.empty:
            return {"keyword": clean, "geo": geo, "regions": []}

        df = df.sort_values(by=clean, ascending=False).head(15)

        return {
            "keyword":    clean,
            "geo":        geo,
            "resolution": resolution,
            "regions": [
                {"location": loc, "interest": int(row[clean])}
                for loc, row in df.iterrows()
                if int(row[clean]) > 0
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Trends error: {str(e)}")


@router.get("/trends/compare")
async def google_compare_categories(
    geo:       str = Query(default="US"),
    timeframe: str = Query(default="today 3-m"),
):
    """Compare Olive Mode's core product categories against each other."""
    try:
        pt = get_pytrends()
        build_payload(pt, OLIVE_MODE_CATEGORIES, timeframe, geo)
        df = interest_over_time(pt)

        if df.empty:
            return {"categories": [], "geo": geo, "timeframe": timeframe}

        summary = []
        for cat in OLIVE_MODE_CATEGORIES:
            if cat in df.columns:
                values = df[cat].tolist()
                summary.append({
                    "category":     cat,
                    "avg_interest": round(sum(values[-4:]) / 4, 1) if values else 0,
                    "peak":         max(values) if values else 0,
                    "trend":        values[-8:],
                })

        summary.sort(key=lambda x: x["avg_interest"], reverse=True)

        return {"geo": geo, "timeframe": timeframe, "categories": summary}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Trends error: {str(e)}")