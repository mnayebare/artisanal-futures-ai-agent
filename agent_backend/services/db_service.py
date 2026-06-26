# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Database Service
# File: services/db_service.py
# ─────────────────────────────────────────────────────────────────────────────

import os
import uuid
import json
import asyncpg

_pool: asyncpg.Pool | None = None


# ─── Connection ───────────────────────────────────────────────────────────────

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        db_url = os.getenv("DATABASE_URL", "").strip('"').strip("'")
        try:
            _pool = await asyncpg.create_pool(
                dsn=db_url,
                min_size=1,
                max_size=10,
                ssl=False,
            )
            print("[db] connection pool created successfully")
        except Exception as e:
            print(f"[db] connection failed: {e}")
            raise
    return _pool


# ─── Chat Sessions ────────────────────────────────────────────────────────────

async def create_session(title: str = "New chat", user_id: str | None = None) -> dict:
    try:
        pool   = await get_pool()
        new_id = str(uuid.uuid4())
        row    = await pool.fetchrow(
            """
            INSERT INTO chat_sessions (id, title, "userId", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING id, title, "createdAt"
            """,
            new_id, title, user_id
        )
        print(f"[db] session created: {new_id}")
        return dict(row)
    except Exception as e:
        print(f"[db] create_session error: {e}")
        raise


async def get_sessions(user_id: str | None = None) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT
            cs.id,
            cs.title,
            cs."updatedAt",
            COUNT(cm.id) AS message_count
        FROM chat_sessions cs
        LEFT JOIN chat_messages cm ON cm."sessionId" = cs.id
        WHERE ($1::text IS NULL OR cs."userId" = $1)
        GROUP BY cs.id, cs.title, cs."updatedAt"
        ORDER BY cs."updatedAt" DESC
        LIMIT 50
        """,
        user_id
    )
    return [dict(r) for r in rows]


async def update_session_title(session_id: str, title: str) -> None:
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE chat_sessions
        SET title = $1, "updatedAt" = NOW()
        WHERE id = $2
        """,
        title, session_id
    )


async def delete_session(session_id: str) -> None:
    pool = await get_pool()
    await pool.execute(
        'DELETE FROM chat_sessions WHERE id = $1',
        session_id
    )


# ─── Chat Messages ────────────────────────────────────────────────────────────

async def get_messages(session_id: str) -> list[dict]:
    """Get all messages for a session including metadata."""
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, role, text, "imageUrl", metadata, "createdAt"
        FROM chat_messages
        WHERE "sessionId" = $1
        ORDER BY "createdAt" ASC
        """,
        session_id
    )
    return [dict(r) for r in rows]


async def save_messages_bulk(
    session_id: str,
    messages:   list[dict],
) -> None:
    """Save multiple messages at once including trend/product metadata."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for msg in messages:
                metadata     = msg.get("metadata")
                metadata_str = json.dumps(metadata) if metadata else "{}"
                await conn.execute(
                    """
                    INSERT INTO chat_messages (id, "sessionId", role, text, "imageUrl", metadata, "createdAt")
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
                    ON CONFLICT DO NOTHING
                    """,
                    str(uuid.uuid4()),
                    session_id,
                    msg.get("role"),
                    msg.get("text"),
                    msg.get("imageUrl"),
                    metadata_str,
                )
        await conn.execute(
            'UPDATE chat_sessions SET "updatedAt" = NOW() WHERE id = $1',
            session_id
        )


# ─── Feedback ─────────────────────────────────────────────────────────────────

async def save_feedback(
    session_id:    str,
    message_idx:   int,
    feedback_type: str,
    context:       str | None = None,
    reasoning:     str | None = None,
) -> None:
    """Save thumbs up/down feedback for an agent message."""
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO feedback (id, "sessionId", "messageIdx", type, context, reasoning, "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        """,
        str(uuid.uuid4()), session_id, message_idx, feedback_type, context, reasoning
    )
    print(f"[db] feedback saved: {feedback_type} for message {message_idx}")