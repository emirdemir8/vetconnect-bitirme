"""Input sanitization for security (XSS, injection)."""
from __future__ import annotations

import re
from urllib.parse import urlparse

import bleach


# Allow no HTML tags in user content
ALLOWED_TAGS: list[str] = []


def sanitize_text(value: str | None, max_length: int = 10_000) -> str | None:
    """Strip HTML/dangerous chars and truncate. Returns None for empty."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    cleaned = bleach.clean(s, tags=ALLOWED_TAGS, strip=True)
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned if cleaned else None


def sanitize_optional_text(value: str | None, max_length: int = 10_000) -> str | None:
    """Like sanitize_text but empty string becomes None."""
    out = sanitize_text(value, max_length)
    return out if out else None


def is_safe_image_url(url: str | None) -> bool:
    """Allow only http/https URLs, no javascript or data URIs."""
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    if not url:
        return False
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        if not parsed.netloc:
            return False
        # Block javascript: and data:
        if re.search(r"javascript:|data:", url, re.I):
            return False
        return True
    except Exception:
        return False


def sanitize_image_url(url: str | None, max_length: int = 2000) -> str | None:
    """Return URL if safe, else None."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()[:max_length]
    if not url:
        return None
    return url if is_safe_image_url(url) else None
