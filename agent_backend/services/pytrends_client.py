# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — PyTrends Service
# File: services/pytrends_client.py
# ─────────────────────────────────────────────────────────────────────────────

import re
import time
import random
import pandas as pd
from pytrends.request import TrendReq
from fastapi import HTTPException

FASHION_CATEGORY = 185

# ─── Keyword cleaning ─────────────────────────────────────────────────────────

NOISE_WORDS = [
    "what's", "whats", "what is", "what are",
    "is", "are", "how", "trending", "popular", "hot",
    "in style", "in fashion", "people buying", "people wearing",
    "selling", "selling well", "most popular", "most trending",
    "on pinterest", "on google", "on instagram", "right now",
    "at the moment", "this season", "this summer", "this year", "this month",
    "for summer", "for spring", "for fall", "for winter",
    "in", "the", "a", "an", "for", "with", "and", "or",
    "show me", "find me", "do you have", "looking for",
    "i want", "i need", "can you", "could you",
]

PLURALS: dict[str, str] = {
    "dresses": "dress", "jumpsuits": "jumpsuit", "rompers": "romper",
    "skirts":  "skirt", "tops":      "top",      "blouses": "blouse",
    "bags":    "bag",   "purses":    "purse",    "clutches": "clutch",
    "earrings": "earring", "necklaces": "necklace", "bracelets": "bracelet",
    "outfits": "outfit", "looks": "look", "styles": "style",
    "trends":  "trend", "prints": "print", "colors": "color",
}

SYNONYMS: dict[str, str] = {
    "going out outfit": "night out dress",
    "going out dress":  "night out dress",
    "party dress":      "cocktail dress",
    "date outfit":      "date night dress",
    "beach outfit":     "beach dress",
    "vacation outfit":  "resort wear",
    "summer look":      "summer dress",
    "crossbody":        "crossbody bag",
    "mini":             "mini dress",
    "midi":             "midi dress",
    "maxi":             "maxi dress",
}


def clean_keyword(text: str) -> str:
    """Extract a clean Google Trends-ready keyword from natural language."""

    # Normalize ALL unicode apostrophes and quotes to standard ascii first
    result = text
    for char in ["\u2019", "\u2018", "\u201c", "\u201d", "\u0060", "\u00b4"]:
        result = result.replace(char, "'")
    result = result.lower()

    # Remove contractions (word + apostrophe + optional letters)
    result = re.sub(r"\b\w+'\w*", "", result)

    # Apply synonyms (longest match first)
    for phrase, replacement in sorted(SYNONYMS.items(), key=lambda x: -len(x[0])):
        if phrase in result:
            result = result.replace(phrase, replacement)
            break

    # Strip noise words (longest first)
    for word in sorted(NOISE_WORDS, key=len, reverse=True):
        result = re.sub(rf"\b{re.escape(word)}\b", "", result, flags=re.IGNORECASE)

    # Normalize plurals word by word
    result = " ".join(PLURALS.get(w, w) for w in result.split())

    # Clean all punctuation and extra whitespace
    result = re.sub(r"[?!.,;:\'\"\u2019\u2018]", "", result)
    result = re.sub(r"\s+", " ", result).strip()

    # Cap at 3 words
    words = [w for w in result.split() if w][:3]
    result = " ".join(words)

    print(f"[clean_keyword] '{text}' → '{result}'")
    return result or text.strip()


# ─── PyTrends client ──────────────────────────────────────────────────────────

def get_pytrends() -> TrendReq:
    return TrendReq(
        hl="en-US",
        tz=360,
        retries=2,
        backoff_factor=0.5,
        timeout=(10, 25),
    )


def build_payload(
    pytrends:  TrendReq,
    kw_list:   list[str],
    timeframe: str = "today 3-m",
    geo:       str = "US",
    category:  int = FASHION_CATEGORY,
) -> None:
    """
    Build payload with jittered delay.
    One call sets up context for both interest_over_time
    and related_queries — no second request needed.
    """
    delay = random.uniform(2.0, 4.0)
    print(f"[pytrends] waiting {delay:.1f}s before request...")
    time.sleep(delay)
    pytrends.build_payload(
        kw_list=kw_list,
        timeframe=timeframe,
        geo=geo,
        cat=category,
    )
    # Small pause after payload — related_queries reuses the same token
    time.sleep(random.uniform(0.5, 1.0))


def interest_over_time(pytrends: TrendReq) -> pd.DataFrame:
    df = pytrends.interest_over_time()
    if not df.empty and "isPartial" in df.columns:
        df = df.drop(columns=["isPartial"])
    return df


def calculate_momentum(df: pd.DataFrame, kw_list: list[str]) -> dict:
    """Compare last 4 data points vs previous 4 for momentum."""
    momentum = {}
    for kw in kw_list:
        if kw in df.columns:
            values     = df[kw].tolist()
            recent     = sum(values[-4:])   / 4 if len(values) >= 4 else 0
            previous   = sum(values[-8:-4]) / 4 if len(values) >= 8 else recent
            change_pct = round(((recent - previous) / previous) * 100) if previous > 0 else 0
            momentum[kw] = {
                "current_avg":  round(recent, 1),
                "previous_avg": round(previous, 1),
                "change_pct":   change_pct,
                "direction":    "up" if change_pct > 0 else "down" if change_pct < 0 else "flat",
            }
    return momentum


def shape_related(df) -> list[dict]:
    if df is None or df.empty:
        return []
    return [
        {"query": row["query"], "value": int(row["value"])}
        for _, row in df.iterrows()
    ]