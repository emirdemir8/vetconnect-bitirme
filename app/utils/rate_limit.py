from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings


def _client_ip(request: Request) -> str:
    """Rate-limit anahtarı: proxy arkasındaysak X-Forwarded-For'un ilk IP'si, değilse uzak adres.

    TRUST_PROXY ayarı kapalıyken X-Forwarded-For yok sayılır; aksi halde istemci
    bu başlığı sahteleyip limiti atlayabilir.
    """
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip)
