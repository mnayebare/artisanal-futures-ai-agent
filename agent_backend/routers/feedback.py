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
    type:         str          # "positive" | "negative"
    context:      str | None = None   # agent message text
    reasoning:    str | None = None   # Claude reasoning at time of feedback


@router.post("")
async def save_feedback(body: FeedbackRequest):
    """Save thumbs up or thumbs down feedback for an agent message."""
    if body.type not in ("positive", "negative"):
        raise HTTPException(status_code=400, detail="type must be 'positive' or 'negative'")
    try:
        await db_service.save_feedback(
            session_id    = body.session_id,
            message_idx   = body.message_idx,
            feedback_type = body.type,
            context       = body.context,
            reasoning     = body.reasoning,
        )
        return {"saved": True, "type": body.type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {str(e)}")