from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings


def _client_ip(request: Request) -> str:
    """Rate-limit key: the first IP from X-Forwarded-For if behind a proxy, otherwise the remote address.

    When the TRUST_PROXY setting is off, X-Forwarded-For is ignored; otherwise a client
    could spoof this header and bypass the limit.
    """
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip)
