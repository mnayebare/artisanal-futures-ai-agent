# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Feedback Router
# File: routers/feedback.py
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import db_service

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackRequest(BaseModel):
    session_id:   str
    message_idx:  int
    type:         str
    context:      str | None = None
    reasoning:    str | None = None
    plan:         list | None = None
    keyword:      str | None = None
    intent:       str | None = None


@router.post("")
async def save_feedback(body: FeedbackRequest):
    """Save thumbs up or thumbs down feedback including agent plan for model evaluation."""
    if body.type not in ("positive", "negative"):
        raise HTTPException(status_code=400, detail="type must be 'positive' or 'negative'")
    try:
        await db_service.save_feedback(
            session_id    = body.session_id,
            message_idx   = body.message_idx,
            feedback_type = body.type,
            context       = body.context,
            reasoning     = body.reasoning,
            plan          = body.plan,
            keyword       = body.keyword,
            intent        = body.intent,
        )
        return {"saved": True, "type": body.type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {str(e)}")