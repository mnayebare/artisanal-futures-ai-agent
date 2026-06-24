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
    reply:    str
    intent:   str
    source:   str
    products: list[dict] | None = None
    trends:   list[dict] | None = None


# ─── Chat endpoint ────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint. Receives every message from the frontend,
    detects what the user wants, and routes to the right handler.

    Intent types:
      TREND    → calls Google Trends, returns trend data
      PRODUCT  → queries product database, returns matching products
      GENERAL  → falls back to a simple assistant reply
    """
    try:
        # Step 1 — detect what the user wants
        intent = detect_intent(request.message)

        # Step 2 — route to the right handler
        if intent == Intent.TREND:
            return await handle_trend_query(request.message, intent, request.platform)

        if intent == Intent.PRODUCT:
            return await handle_product_query(request.message, intent)

        return await handle_general_query(
            request.message,
            intent,
            history=[m.dict() for m in request.history],
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")