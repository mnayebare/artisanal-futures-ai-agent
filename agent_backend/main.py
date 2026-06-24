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

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chat, google, pinterest

load_dotenv()

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
#app.include_router(pinterest.router)
app.include_router(google.router)
# app.include_router(shopify.router)   ← add when ready

# ─── Health check ────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "service": "Olive Mode API"}