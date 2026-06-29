# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Chat Router
# File: routers/chat.py
# ─────────────────────────────────────────────────────────────────────────────

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
    image_base64: str | None = None

class IntentRequest(BaseModel):
    message: str
    history: list[ChatMessageIn] = []


# ─── Title generator ──────────────────────────────────────────────────────────

def generate_title(message: str) -> str:
    text = message.strip()
    return text[:40] + "…" if len(text) > 40 else text


# ─── Intent-only endpoint ─────────────────────────────────────────────────────

@router.post("/intent")
async def get_intent(request: IntentRequest):
    """Lightweight — returns intent classification without running full pipeline."""
    try:
        history_dicts = [{"role": m.role, "text": m.text, "metadata": m.metadata} for m in request.history]
        intent, keyword, subreddit, reason, plan = await detect_intent(request.message, history_dicts)
        return {"intent": intent, "keyword": keyword, "reason": reason}
    except Exception:
        return {"intent": "general", "keyword": "", "reason": ""}


# ─── Main chat endpoint ───────────────────────────────────────────────────────

@router.post("")
async def chat(request: ChatRequest):
    try:
        history_dicts = [{"role": m.role, "text": m.text, "metadata": m.metadata} for m in request.history]
        intent, keyword, subreddit, reason, plan = await detect_intent(request.message, history_dicts)

        if intent == Intent.TREND:
            # Always run Google Trends for quantitative data
            result = await handle_trend_query(request.message, intent, "google", keyword)

            # Enrich with Reddit community sentiment
            try:
                reddit_result = await handle_reddit_query(request.message, intent, keyword, subreddit)

                # Merge Reddit reasoning into reasoning panel
                if reddit_result.get("reasoning"):
                    google_reasoning = result.get("reasoning", "")
                    reddit_reasoning = reddit_result["reasoning"]
                    result["reasoning"] = (
                        google_reasoning +
                        "\n\n**Community Sentiment (Reddit)**\n" +
                        reddit_reasoning
                        if google_reasoning else reddit_reasoning
                    )

                # Append Reddit post links to the reply
                if reddit_result.get("reply") and "Found" in reddit_result.get("reply", ""):
                    result["reply"] = (
                        result.get("reply", "") +
                        "\n\n" + reddit_result["reply"]
                    )

                # Pass through reddit_posts for storage
                if reddit_result.get("reddit_posts"):
                    result["reddit_posts"] = reddit_result["reddit_posts"]

            except Exception as e:
                print(f"[chat] reddit enrichment failed: {e}")

        elif intent == Intent.CLARIFY:
            result = {
                "reply":  f"Could you tell me more about what you're looking for with \"{request.message}\"? "
                          f"Are you researching how this product is trending in the market, or looking at your own store inventory?",
                "intent": intent,
                "source": "clarify",
            }

        elif intent == Intent.PRODUCT:
            result = await handle_product_query(request.message, intent, keyword)

        else:
            result = await handle_general_query(
                request.message,
                intent,
                history=history_dicts,
            )

        # Suggested title on first message
        if not request.history:
            result["suggested_title"] = generate_title(request.message)

        # Store intent metadata including plan
        result["intent_data"] = {
            "intent":    intent,
            "keyword":   keyword,
            "subreddit": subreddit,
            "reason":    reason,
            "plan":      plan,
        }

        return result

    except Exception as e:
        import traceback
        print(f"[chat] 500 error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")