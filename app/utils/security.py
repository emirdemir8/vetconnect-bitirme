from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.db.mongo import get_db


bearer_scheme = HTTPBearer(auto_error=False)

RoleType = Literal["vet", "pet_owner", "admin"]

# bcrypt en fazla 72 bayt şifre kabul eder
def _password_bytes(password: str) -> bytes:
    b = password.encode("utf-8")
    return b[:72] if len(b) > 72 else b


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(password), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "iat": int(now.timestamp()), "exp": exp}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kimlik doğrulama bilgisi yok",
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş token",
        )
    email = payload.get("sub")
    role = payload.get("role")
    if not email or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Eksik token payload")

    db = get_db()
    doc = db["users"].find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı bulunamadı")

    return {
        "id": str(doc.get("_id")),
        "email": doc.get("email"),
        "role": doc.get("role"),
    }


def require_role(*allowed_roles: RoleType):
    async def dependency(current=Depends(get_current_user)):
        if current["role"] not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim")
        return current

    return dependency
