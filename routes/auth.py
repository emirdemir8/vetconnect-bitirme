from __future__ import annotations

import bleach
from bson import ObjectId

from app.utils.sanitize import sanitize_optional_text
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.db.mongo import get_db
from app.utils.security import (
    RoleType,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: RoleType = "pet_owner"
    full_name: str | None = Field(default=None, max_length=200, description="Ad Soyad (veteriner panelinde sahip olarak görünür)")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class MeOut(BaseModel):
    id: str
    email: EmailStr
    role: RoleType
    full_name: str | None = None


class MeUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn):
    try:
        db = get_db()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Veritabanı bağlantısı kurulamadı. MongoDB çalışıyor mu? ({e!s})",
        )
    email = bleach.clean(payload.email, strip=True).lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçerli bir e-posta girin.")
    if db["users"].find_one({"email": email}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu e-posta adresi zaten kayıtlı.")

    role: RoleType = payload.role
    raw_password = payload.password.strip() if isinstance(payload.password, str) else payload.password
    if len(raw_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Şifre en az 6 karakter olmalı.")

    try:
        password_hash = hash_password(raw_password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Şifre işlenemedi (bcrypt yüklü mü?): {e!s}",
        ) from e

    full_name = sanitize_optional_text(getattr(payload, "full_name", None), 200)
    doc = {
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "full_name": full_name or None,
    }
    try:
        result = db["users"].insert_one(doc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kayıt yazılamadı: {e!s}",
        )
    return {"id": str(result.inserted_id), "email": email, "role": role}


@router.post("/login")
def login(payload: LoginIn):
    try:
        db = get_db()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Veritabanı bağlantısı kurulamadı. MongoDB çalışıyor mu? ({e!s})",
        )
    email = bleach.clean(payload.email, strip=True).lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçerli bir e-posta girin.")
    doc = db["users"].find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-posta veya şifre hatalı.")
    stored_hash = doc.get("password_hash") or ""
    raw_password = payload.password.strip() if isinstance(payload.password, str) else payload.password
    try:
        ok = verify_password(raw_password, stored_hash)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Şifre doğrulanamadı (bcrypt?): {e!s}",
        ) from e
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-posta veya şifre hatalı.")

    role: RoleType = doc.get("role", "pet_owner")  # type: ignore[assignment]
    token = create_access_token(subject=email, extra_claims={"role": role})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=MeOut)
async def me(current=Depends(get_current_user)):
    try:
        db = get_db()
        u = db["users"].find_one({"_id": ObjectId(current["id"])}, {"full_name": 1})
        full_name = (u.get("full_name") or "").strip() or None if u else None
    except Exception:
        full_name = None
    return MeOut(id=current["id"], email=current["email"], role=current["role"], full_name=full_name)


@router.patch("/me", response_model=MeOut)
async def update_me(payload: MeUpdate, current=Depends(get_current_user)):
    """Update current user profile (e.g. display name)."""
    db = get_db()
    full_name = sanitize_optional_text(payload.full_name, 200)
    db["users"].update_one(
        {"_id": ObjectId(current["id"])},
        {"$set": {"full_name": full_name}},
    )
    return MeOut(
        id=current["id"],
        email=current["email"],
        role=current["role"],
        full_name=full_name,
    )
