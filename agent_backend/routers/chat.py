# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Chat Router
# File: routers/chat.py
# ─────────────────────────────────────────────────────────────────────────────

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.intent import detect_intent, Intent
from services.responders import (
    handle_trend_query,
    handle_reddit_query,
    handle_product_query,
    handle_general_query,
)

router = APIRouter(prefix="/chat", tags=["Chat"])


# ─── Models ───────────────────────────────────────────────────────────────────

class ChatMessageIn(BaseModel):
    role:     str
    text:     str
    metadata: dict | None = None

class ChatRequest(BaseModel):
    message:      str
    history:      list[ChatMessageIn] = []
    platform:     str | None = None
    image_base64: str | None = None

class IntentRequest(BaseModel):
    message: str
    history: list[ChatMessageIn] = []


# ─── Title generator ──────────────────────────────────────────────────────────

def generate_title(message: str) -> str:
    """Use the user's message directly as the session title."""
    text = message.strip()
    return text[:40] + "…" if len(text) > 40 else text


# ─── Intent-only endpoint (lightweight — for platform selector hint) ──────────

@router.post("/intent")
async def get_intent(request: IntentRequest):
    """Returns intent classification and platform recommendation without running full pipeline."""
    try:
        history_dicts = [{"role": m.role, "text": m.text, "metadata": m.metadata} for m in request.history]
        intent, keyword, subreddit, best_platform, reason = await detect_intent(
            request.message,
            history=history_dicts,
        )
        return {
            "intent":        intent,
            "keyword":       keyword,
            "best_platform": best_platform,
            "reason":        reason,
        }
    except Exception:
        return {"intent": "general", "keyword": "", "best_platform": "either", "reason": ""}


# ─── Main chat endpoint ───────────────────────────────────────────────────────

@router.post("")
async def chat(request: ChatRequest):
    try:
        # Claude classifies intent with full conversation context
        history_dicts = [{"role": m.role, "text": m.text, "metadata": m.metadata} for m in request.history]
        intent, keyword, subreddit, best_platform, reason = await detect_intent(
            request.message,
            request.platform,
            history_dicts,
        )

        if intent == Intent.TREND:
            if request.platform == "reddit":
                result = await handle_reddit_query(request.message, intent, keyword, subreddit)
            elif request.platform == "pinterest":
                result = {
                    "reply":  "Pinterest Trends is pending approval. Please use Google Trends or Reddit instead.",
                    "intent": intent,
                    "source": "pinterest",
                }
            else:
                result = await handle_trend_query(request.message, intent, request.platform, keyword)

            result["best_platform"] = best_platform

        elif intent == Intent.CLARIFY:
            result = {
                "reply":         f"Could you tell me more about what you're looking for with \"{request.message}\"? Are you researching how this product is trending in the market, or looking at your own store inventory?",
                "intent":        intent,
                "source":        "clarify",
                "best_platform": best_platform,
            }

        elif intent == Intent.PRODUCT:
            result = await handle_product_query(request.message, intent, keyword)

        else:
            result = await handle_general_query(
                request.message,
                intent,
                history=[{"role": m.role, "text": m.text, "metadata": m.metadata} for m in request.history],
            )

        # Add suggested title on first message
        if not request.history:
            result["suggested_title"] = generate_title(request.message)

        # Always include intent metadata for storage
        result["intent_data"] = {
            "intent":        intent,
            "keyword":       keyword,
            "subreddit":     subreddit,
            "best_platform": best_platform,
            "reason":        reason,
        }

        return result

    except Exception as e:
        import traceback
        print(f"[chat] 500 error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")