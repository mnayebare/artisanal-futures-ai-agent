# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Intent Detection
# File: services/intent.py
#
# Reads the user's message and classifies what they want.
# This runs before any API calls so we know where to route.
# ─────────────────────────────────────────────────────────────────────────────

from enum import Enum
import re


class Intent(str, Enum):
    TREND   = "trend"     # asking about trends
    PRODUCT = "product"   # looking for a product
    GENERAL = "general"   # general conversation


# ─── Keyword lists ────────────────────────────────────────────────────────────

TREND_SIGNALS = [
    "trend", "trending", "popular", "what's hot", "in style",
    "in fashion", "what's popular", "selling", "people buying",
    "people wearing", "hot right now", "what's in", "everyone wearing",
    "google trends", "most searched",
]

PRODUCT_SIGNALS = [
    "find", "show me", "looking for", "do you have", "got any",
    "recommend", "suggest", "what do you have", "i want", "i need",
    "under $", "budget", "price", "how much", "affordable",
    "dress", "bag", "jewelry", "top", "skirt", "jumpsuit",
    "romper", "perfume", "beauty", "earring", "necklace",
    "crossbody", "tote", "clutch", "outfit", "style",
]


# ─── Keyword extractor ────────────────────────────────────────────────────────

NOISE_WORDS = [
    "what's", "what is", "what are", "whats", "is", "are",
    "trending", "popular", "hot", "in style", "in fashion",
    "people buying", "people wearing", "selling",
    "on pinterest", "on google", "right now", "at the moment",
    "this season", "this summer", "this year", "this month",
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
    "outfits": "outfit", "looks":    "look",     "styles":   "style",
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


def extract_keyword(text: str) -> str:
    """Extract a clean search keyword from natural language."""
    result = text.lower()

    # Apply synonyms first
    for phrase, replacement in SYNONYMS.items():
        if phrase in result:
            result = result.replace(phrase, replacement)

    # Strip noise words (longest first)
    for word in sorted(NOISE_WORDS, key=len, reverse=True):
        result = re.sub(rf"\b{re.escape(word)}\b", "", result, flags=re.IGNORECASE)

    # Normalize plurals
    result = " ".join(PLURALS.get(w, w) for w in result.split())

    # Clean up and cap at 4 words
    result = re.sub(r"[?!.,]", "", result).strip()
    words  = [w for w in result.split() if w][:4]
    return " ".join(words) or text.strip()


# ─── Intent detector ──────────────────────────────────────────────────────────

def detect_intent(message: str) -> Intent:
    """
    Classify the user's message into one of three intents.

    Examples:
      "what's trending in mesh dresses?"  → TREND
      "show me bags under $80"            → PRODUCT
      "hi, how are you?"                  → GENERAL
    """
    lower = message.lower()

    # Trend signals take priority — check first
    if any(signal in lower for signal in TREND_SIGNALS):
        return Intent.TREND

    # Product signals — looking for something to buy
    if any(signal in lower for signal in PRODUCT_SIGNALS):
        return Intent.PRODUCT

    # Everything else
    return Intent.GENERAL