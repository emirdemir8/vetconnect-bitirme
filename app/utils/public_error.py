from __future__ import annotations

from app.core.config import settings


def safe_detail(message: str) -> str:
    """In production, do not leak internal error details to clients."""
    if settings.is_production:
        return "A temporary server error occurred. Please try again later."
    return message
