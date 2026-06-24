# ─────────────────────────────────────────────────────────────────────────────
# Olive Mode — Pinterest HTTP Client
# File: services/pinterest_client.py
#
# Handles all raw HTTP calls to the Pinterest API.
# Routers call these functions — they never call Pinterest directly.
# ─────────────────────────────────────────────────────────────────────────────

import os
import httpx
from fastapi import HTTPException

PINTEREST_API_URL = "https://api.pinterest.com/v5"


def pinterest_headers() -> dict:
    token = os.getenv("PINTEREST_ACCESS_TOKEN")
    if not token:
        raise HTTPException(
            status_code=500,
            detail="PINTEREST_ACCESS_TOKEN not set in environment variables."
        )
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }


async def pinterest_get(path: str, params: dict = {}) -> dict:
    """
    Make an authenticated GET request to the Pinterest API.
    Handles common error codes centrally so routers stay clean.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{PINTEREST_API_URL}{path}",
                headers=pinterest_headers(),
                params=params,
                timeout=10.0,
            )

            if response.status_code == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Pinterest token invalid or expired. Refresh at developers.pinterest.com."
                )
            if response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="Pinterest Standard access required. Apply at developers.pinterest.com."
                )
            if not response.is_success:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Pinterest API error: {response.text}"
                )

            return response.json()

        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Pinterest API timed out.")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Network error: {str(e)}")