# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Web Search Router (Tavily)
# File: routers/websearch.py
#
# Uses Tavily to search the web for rising trend queries.
# Returns real web links — news, retailers, Instagram, blogs.
#
# Install: pip install tavily-python
# Sign up: https://tavily.com → get free API key
# Add to .env: TAVILY_API_KEY=your_key
# ─────────────────────────────────────────────────────────────────────────────

import os
from fastapi import APIRouter, HTTPException, Query
from tavily import TavilyClient

router = APIRouter(prefix="/websearch", tags=["Web Search"])


def get_tavily() -> TavilyClient:
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="TAVILY_API_KEY not set in environment variables."
        )
    return TavilyClient(api_key=api_key)


# Olive Mode's primary suppliers and wholesale sources — searched first
SUPPLIER_DOMAINS = [
    "fashiongo.net",
    "faire.com",
    "adjoaa.com",
    "motthelabel.com",
    "shoponuli.com",

    # African fashion suppliers
    "shopbusayo.com",
    "diyanu.com",
    "africaimports.com",
    "dupsies.com",
]

# Fashion media and editorial — used as fallback
FASHION_MEDIA_DOMAINS = [
    "vogue.com",
    "harpersbazaar.com",
    "elle.com",
    "whowhatwear.com",
    "refinery29.com",
    "fashionista.com",
    "wwd.com",
    "instyle.com",
    "popsugar.com",
    "glamour.com",
    "cosmopolitan.com",
    "people.com",
    "tmz.com",
]

# Combined — suppliers first, then editorial
ALL_FASHION_DOMAINS = SUPPLIER_DOMAINS + FASHION_MEDIA_DOMAINS


@router.get("/search")
async def web_search(
    query:        str = Query(description="Search query"),
    max_results:  int = Query(default=5, ge=1, le=10),
    search_depth: str = Query(default="basic", description="basic | advanced"),
):
    """Search the web for a query — suppliers first, then fashion media."""
    try:
        client  = get_tavily()
        results = client.search(
            query           = query,
            max_results     = max_results,
            search_depth    = search_depth,
            include_domains = ALL_FASHION_DOMAINS,
        )
        return {
            "query":   query,
            "results": [
                {
                    "title":   r.get("title", ""),
                    "url":     r.get("url", ""),
                    "snippet": r.get("content", "")[:200],
                    "score":   round(r.get("score", 0), 3),
                }
                for r in results.get("results", [])
            ],
        }
    except Exception as e:
        print(f"[websearch] error: {e}")
        raise HTTPException(status_code=500, detail=f"Web search error: {str(e)}")


async def search_supplier_products(query: str, max_results: int = 5) -> list[dict]:
    """Search Olive Mode's supplier sites for products matching the query."""
    try:
        client  = get_tavily()
        results = client.search(
            query           = query,
            max_results     = max_results,
            search_depth    = "basic",
            include_domains = SUPPLIER_DOMAINS,
        )
        links = [
            {
                "title":       r.get("title", ""),
                "url":         r.get("url", ""),
                "snippet":     r.get("content", "")[:150],
                "source":      r.get("url", "").split("/")[2].replace("www.", "") if r.get("url") else "",
                "is_supplier": True,
            }
            for r in results.get("results", [])
            if r.get("title") and r.get("url")
        ]
        print(f"[websearch] supplier search '{query}' → {len(links)} results: {[l['source'] for l in links]}")
        return links
    except Exception as e:
        print(f"[websearch] supplier search failed: {e}")
        return []


async def search_media_coverage(query: str, max_results: int = 3) -> list[dict]:
    """Search fashion media sites for editorial coverage of a trend query."""
    try:
        client  = get_tavily()
        results = client.search(
            query           = query,
            max_results     = max_results,
            search_depth    = "basic",
            include_domains = FASHION_MEDIA_DOMAINS,
        )
        links = [
            {
                "title":       r.get("title", ""),
                "url":         r.get("url", ""),
                "snippet":     r.get("content", "")[:150],
                "source":      r.get("url", "").split("/")[2].replace("www.", "") if r.get("url") else "",
                "is_supplier": False,
            }
            for r in results.get("results", [])
            if r.get("title") and r.get("url")
            and ".xml" not in r.get("url", "").lower()
            and "sitemap" not in r.get("url", "").lower()
            and "[xml]" not in r.get("title", "").lower()
        ]
        print(f"[websearch] media search '{query}' → {len(links)} results: {[l['source'] for l in links]}")
        return links
    except Exception as e:
        print(f"[websearch] media search failed: {e}")
        return []
    try:
        client = get_tavily()

        def is_valid(r: dict) -> bool:
            url   = r.get("url", "").lower()
            title = r.get("title", "").lower()
            if any(bad in url   for bad in [".xml", "sitemap", "/feed", ".rss"]): return False
            if any(bad in title for bad in ["[xml]", "sitemap", "rss feed"]):     return False
            if not r.get("title") or not r.get("url"): return False
            return True

        def extract(results: dict) -> list[dict]:
            return [
                {
                    "title":   r.get("title", ""),
                    "url":     r.get("url", ""),
                    "snippet": r.get("content", "")[:150],
                    "source":  r.get("url", "").split("/")[2].replace("www.", "") if r.get("url") else "",
                }
                for r in results.get("results", [])
                if is_valid(r)
            ]

        # Step 1 — try supplier domains first, get all results
        print(f"[websearch] searching suppliers for '{query}'")
        results      = client.search(
            query           = query,
            max_results     = max_results,
            search_depth    = "basic",
            include_domains = SUPPLIER_DOMAINS,
        )
        supplier_links = extract(results)
        print(f"[websearch] found {len(supplier_links)} supplier results: "
              f"{[l['source'] for l in supplier_links]}")

        # Step 2 — also search fashion media regardless
        print(f"[websearch] searching fashion media for '{query}'")
        results     = client.search(
            query           = query,
            max_results     = max_results,
            search_depth    = "basic",
            include_domains = FASHION_MEDIA_DOMAINS,
        )
        media_links = extract(results)
        print(f"[websearch] found {len(media_links)} media results: "
              f"{[l['source'] for l in media_links]}")

        # Combine — suppliers first, then media
        all_links = supplier_links + media_links

        # Step 3 — open web fallback only if nothing found at all
        if not all_links:
            print(f"[websearch] no results in curated domains, falling back to open web")
            results   = client.search(query=query, max_results=max_results, search_depth="basic")
            all_links = extract(results)
            print(f"[websearch] found {len(all_links)} open web results")

        return all_links

    except Exception as e:
        print(f"[websearch] search_rising_query failed: {e}")
        return []