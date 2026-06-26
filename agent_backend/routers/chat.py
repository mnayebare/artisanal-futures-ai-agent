# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Chat Router
# File: routers/chat.py
#
# Receives every message from the Next.js frontend.
# Detects intent and routes to the right service.
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.intent import detect_intent, Intent
from services.responders import (
    handle_trend_query,
    handle_product_query,
    handle_general_query,
)

router = APIRouter(prefix="/chat", tags=["Chat"])


# ─── Request / Response models ────────────────────────────────────────────────

class ChatMessageIn(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    message:      str
    history:      list[ChatMessageIn] = []
    platform:     str | None = None
    image_base64: str | None = None

class ChatResponse(BaseModel):
    reply:           str
    intent:          str
    source:          str
    suggested_title: str | None = None
    products:        list[dict] | None = None
    trends:          list[dict] | None = None


# ─── Title generator ──────────────────────────────────────────────────────────

def generate_title(message: str) -> str:
    """Use the user's message directly as the session title."""
    text = message.strip()
    return text[:40] + "…" if len(text) > 40 else text


# ─── Chat endpoint ────────────────────────────────────────────────────────────

@router.post("")
async def chat(request: ChatRequest):
    try:
        intent = detect_intent(request.message)

        if intent == Intent.TREND:
            result = await handle_trend_query(request.message, intent, request.platform)
        elif intent == Intent.PRODUCT:
            result = await handle_product_query(request.message, intent)
        else:
            result = await handle_general_query(
                request.message,
                intent,
                history=[m.dict() for m in request.history],
            )

        # Add suggested title on first message (no history yet)
        if not request.history:
            result["suggested_title"] = generate_title(request.message)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")