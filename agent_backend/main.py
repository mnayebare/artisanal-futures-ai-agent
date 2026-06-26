# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — FastAPI Entry Point
# File: main.py
#
# Setup:
#   pip install fastapi uvicorn httpx python-dotenv pytrends
#
# Run:
#   uvicorn main:app --reload --port 8000
# ─────────────────────────────────────────────────────────────────────────────

from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chat, google, pinterest, sessions, feedback

# Explicitly load .env from the same directory as main.py
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Olive Mode API",
    description="Backend API for Olive Mode AI Sales Agent",
    version="1.0.0",
)

# ─── CORS ────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(chat.router)
app.include_router(sessions.router)
app.include_router(feedback.router)
app.include_router(google.router)
# app.include_router(pinterest.router) ← disabled until Standard access approved
# app.include_router(shopify.router)   ← add when ready

# ─── Health check ────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    import os
    return {
        "status": "ok",
        "service": "Olive Mode API",
        "db_configured": bool(os.getenv("DATABASE_URL")),
        "pinterest_configured": bool(os.getenv("PINTEREST_ACCESS_TOKEN")),
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
    }