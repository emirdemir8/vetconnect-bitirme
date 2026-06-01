from __future__ import annotations

import hashlib
import secrets
import string
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


def generate_reset_token() -> str:
    """High-entropy, URL-safe reset token."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 digest of the token to be stored in the DB (the raw token is not stored)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_temp_password(length: int = 12) -> str:
    """Generates a temporary password containing letters and digits for admin reset."""
    length = max(10, length)
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isalpha() for c in pw) and any(c.isdigit() for c in pw):
            return pw


_COMMON_PASSWORDS = frozenset(
    {
        "password", "12345678", "123456789", "1234567890", "qwerty123",
        "password1", "password123", "11111111", "00000000", "abcdefgh",
        "iloveyou", "admin123", "welcome1", "qwertyuiop", "1q2w3e4r",
        "letmein1", "sunshine", "football", "baseball", "dragon123",
    }
)


def validate_password_strength(password: str, *, email: str | None = None) -> str | None:
    """Returns an error message (str) if the password is not strong enough, or None if it is acceptable."""
    if not isinstance(password, str):
        return "Password must be text."
    pw = password.strip()
    if len(pw) < 8:
        return "Password must be at least 8 characters."
    if len(pw) > 128:
        return "Password must be at most 128 characters."
    if not any(c.isalpha() for c in pw):
        return "Password must contain at least one letter."
    if not any(c.isdigit() for c in pw):
        return "Password must contain at least one number."
    if pw.lower() in _COMMON_PASSWORDS:
        return "This password is too common. Please choose a stronger one."
    if email:
        local = email.split("@", 1)[0].strip().lower()
        if local and len(local) >= 3 and local in pw.lower():
            return "Password must not contain your email address."
    return None


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
            detail="Authentication required",
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    email = payload.get("sub")
    role = payload.get("role")
    if not email or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    db = get_db()
    doc = db["users"].find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return {
        "id": str(doc.get("_id")),
        "email": doc.get("email"),
        "role": doc.get("role"),
    }


def require_role(*allowed_roles: RoleType):
    async def dependency(current=Depends(get_current_user)):
        if current["role"] not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return current

    return dependency
