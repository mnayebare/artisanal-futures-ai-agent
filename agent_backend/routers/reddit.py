# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Reddit Router
# File: routers/reddit.py
# Install: pip install asyncpraw
# ─────────────────────────────────────────────────────────────────────────────

import os
import asyncpraw
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/reddit", tags=["Reddit"])

# ─── Subreddit selection ──────────────────────────────────────────────────────

SUBREDDIT_MAP: dict[str, list[str]] = {
    "bag":          ["handbags"],
    "purse":        ["handbags"],
    "clutch":       ["handbags"],
    "tote":         ["handbags"],
    "satchel":      ["handbags"],
    "crossbody":    ["handbags"],
    "handbag":      ["handbags"],
    "jewelry":      ["jewelry"],
    "jewellery":    ["jewelry"],
    "earring":      ["jewelry"],
    "necklace":     ["jewelry"],
    "bracelet":     ["jewelry"],
    "ring":         ["jewelry"],
    "perfume":      ["fragrance"],
    "fragrance":    ["fragrance"],
    "scent":        ["fragrance"],
    "hair perfume": ["fragrance"],
    "dress":        ["femalefashionadvice"],
    "outfit":       ["femalefashionadvice"],
    "style":        ["femalefashionadvice"],
    "fashion":      ["femalefashionadvice"],
    "clothing":     ["femalefashionadvice"],
    "top":          ["femalefashionadvice"],
    "skirt":        ["femalefashionadvice"],

    # ── African fashion keywords ──────────────────────────────────────────────
    "african":      ["femalefashionadvice"],
    "ankara":       ["femalefashionadvice"],
    "kente":        ["femalefashionadvice"],
    "adire":        ["femalefashionadvice"],
    "dashiki":      ["femalefashionadvice"],
    "afropunk":     ["femalefashionadvice"],
    "afro":         ["femalefashionadvice"],
    "kitenge":      ["femalefashionadvice"],
    "wax print":    ["femalefashionadvice"],
    "african print":["femalefashionadvice"],
}

DEFAULT_SUBREDDITS = ["femalefashionadvice"]


def select_subreddits(keyword: str) -> list[str]:
    lower = keyword.lower()
    for term, subreddits in SUBREDDIT_MAP.items():
        if term in lower:
            return subreddits
    return DEFAULT_SUBREDDITS


# ─── Async PRAW client ────────────────────────────────────────────────────────

def get_reddit() -> asyncpraw.Reddit:
    return asyncpraw.Reddit(
        client_id     = os.getenv("REDDIT_CLIENT_ID"),
        client_secret = os.getenv("REDDIT_CLIENT_SECRET"),
        user_agent    = os.getenv("REDDIT_USER_AGENT", "OliveMode/1.0"),
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def fetch_subreddit_posts(
    subreddit: str,
    keyword:   str,
    limit:     int = 10,
) -> list[dict]:
    """Search a subreddit for posts matching the keyword."""
    async with get_reddit() as reddit:
        sub   = await reddit.subreddit(subreddit)
        posts = []

        async for submission in sub.search(keyword, sort="relevance", time_filter="month", limit=limit):
            if submission.score < 5:
                continue
            posts.append({
                "title":     submission.title,
                "text":      submission.selftext[:500] if submission.selftext else "",
                "score":     submission.score,
                "comments":  submission.num_comments,
                "url":       f"https://reddit.com{submission.permalink}",
                "permalink": submission.permalink,
                "flair":     submission.link_flair_text or "",
                "subreddit": subreddit,
            })

    return posts


async def fetch_post_comments(permalink: str, limit: int = 5) -> list[str]:
    """Fetch top comments from a Reddit post."""
    try:
        async with get_reddit() as reddit:
            submission = await reddit.submission(url=f"https://reddit.com{permalink}")
            await submission.comments.replace_more(limit=0)

            comments = []
            for comment in submission.comments[:limit]:
                body = getattr(comment, "body", "")
                if body and body not in ("[deleted]", "[removed]") and len(body) > 20:
                    comments.append(body[:300])
            return comments
    except Exception as e:
        print(f"[reddit] comment fetch error: {e}")
        return []


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/search")
async def reddit_search(
    keyword:       str        = Query(description="Fashion keyword to search for"),
    subreddit:     str | None = Query(default=None),
    limit:         int        = Query(default=8, ge=1, le=25),
    with_comments: bool       = Query(default=True),
):
    """Search fashion subreddits for posts matching a keyword."""
    try:
        subreddits = [subreddit] if subreddit else select_subreddits(keyword)
        print(f"[reddit] keyword='{keyword}' → subreddits={subreddits}")

        all_posts = []
        for sub in subreddits:
            try:
                posts = await fetch_subreddit_posts(sub, keyword, limit)
                all_posts.extend(posts)
            except Exception as e:
                print(f"[reddit] error fetching r/{sub}: {e}")

        all_posts.sort(key=lambda p: p["score"], reverse=True)
        top_posts = all_posts[:limit]

        if with_comments:
            for post in top_posts[:3]:
                try:
                    post["top_comments"] = await fetch_post_comments(post["permalink"])
                except Exception:
                    post["top_comments"] = []

        return {
            "keyword":    keyword,
            "subreddits": subreddits,
            "total":      len(top_posts),
            "posts":      top_posts,
        }

    except Exception as e:
        print(f"[reddit] search error: {e}")
        raise HTTPException(status_code=500, detail=f"Reddit search error: {str(e)}")


@router.get("/subreddit")
async def get_subreddit_for_keyword(keyword: str = Query(description="Keyword to check")):
    """Returns which subreddit(s) would be selected for a given keyword."""
    return {
        "keyword":    keyword,
        "subreddits": select_subreddits(keyword),
    }