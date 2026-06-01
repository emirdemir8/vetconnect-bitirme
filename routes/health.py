from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    mongo_ok = False
    mongo_error: str | None = None
    try:
        from app.db.mongo import get_db

        get_db().command("ping")
        mongo_ok = True
    except Exception as e:
        mongo_error = str(e)
    return {
        "status": "ok" if mongo_ok else "degraded",
        "mongodb": mongo_ok,
        "mongodb_error": mongo_error,
    }
