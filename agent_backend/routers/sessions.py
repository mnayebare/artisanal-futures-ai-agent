# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Sessions Router
# File: routers/sessions.py
#
# Handles chat session persistence — create, list, load, delete.
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import db_service

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# ─── Models ───────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    title:   str   = "New chat"
    user_id: str | None = None

class SaveMessagesRequest(BaseModel):
    session_id: str
    title:      str | None = None
    messages:   list[dict]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def list_sessions(user_id: str | None = None):
    """
    Get all chat sessions for the sidebar history list.
    Returns id, title, updatedAt and message_count.
    """
    try:
        sessions = await db_service.get_sessions(user_id)
        return {
            "sessions": [
                {
                    "id":            str(s["id"]),
                    "title":         s["title"],
                    "updatedAt":     s["updatedAt"].isoformat() if s["updatedAt"] else None,
                    "messageCount":  int(s["message_count"]),
                }
                for s in sessions
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load sessions: {str(e)}")


@router.post("")
async def create_session(body: CreateSessionRequest):
    """Create a new chat session and return its ID."""
    try:
        session = await db_service.create_session(body.title, body.user_id)
        return {
            "id":        str(session["id"]),
            "title":     session["title"],
            "createdAt": session["createdAt"].isoformat() if session["createdAt"] else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.get("/{session_id}/messages")
async def get_session_messages(session_id: str):
    """Load all messages for a specific chat session."""
    try:
        messages = await db_service.get_messages(session_id)
        return {
            "session_id": session_id,
            "messages": [
                {
                    "role":      m["role"],
                    "text":      m["text"],
                    "imageUrl":  m.get("imageUrl"),
                    "createdAt": m["createdAt"].isoformat() if m.get("createdAt") else None,
                }
                for m in messages
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load messages: {str(e)}")


@router.post("/save")
async def save_session_messages(body: SaveMessagesRequest):
    """
    Save all messages from a chat exchange to the database.
    Called after each agent response so nothing is lost.
    Also updates the session title if provided.
    """
    try:
        if body.title:
            await db_service.update_session_title(body.session_id, body.title)

        await db_service.save_messages_bulk(body.session_id, body.messages)

        return {"saved": True, "session_id": body.session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save messages: {str(e)}")


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session and all its messages."""
    try:
        await db_service.delete_session(session_id)
        return {"deleted": True, "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")