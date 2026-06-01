from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bleach
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from app.core.config import settings
from app.db.mongo import get_db
from app.utils.email import send_email
from app.utils.public_error import safe_detail
from app.utils.rate_limit import limiter
from app.utils.sanitize import sanitize_optional_text
from app.utils.security import (
    RoleType,
    create_access_token,
    generate_reset_token,
    get_current_user,
    hash_password,
    hash_token,
    validate_password_strength,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=200, description="Display name (shown to vets)")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class MeOut(BaseModel):
    id: str
    email: EmailStr
    role: RoleType
    full_name: str | None = None
    clinic_id: str | None = None
    clinic_name: str | None = None


class MeUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    clinic_id: str | None = Field(
        default=None,
        description="Pet owner clinic membership (ObjectId). Empty string clears it.",
    )


def _me_out_from_db(db, current: dict) -> MeOut:
    u = db["users"].find_one({"_id": ObjectId(current["id"])}, {"full_name": 1, "clinic_id": 1})
    fn = None
    if u:
        fn = (u.get("full_name") or "").strip() or None
    clinic_id: str | None = None
    clinic_name: str | None = None
    if u and u.get("clinic_id"):
        cid = u["clinic_id"]
        try:
            coid = cid if isinstance(cid, ObjectId) else ObjectId(str(cid))
            co = db["clinics"].find_one({"_id": coid}, {"name": 1})
            if co:
                clinic_id = str(co["_id"])
                clinic_name = co.get("name")
        except Exception:
            pass
    return MeOut(
        id=current["id"],
        email=current["email"],
        role=current["role"],
        full_name=fn,
        clinic_id=clinic_id,
        clinic_name=clinic_name,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.auth_register_limit)
def register(request: Request, payload: RegisterIn):
    """Public registration creates pet_owner only; vet/admin via trusted process."""
    try:
        db = get_db()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=safe_detail(f"Database connection failed. Is MongoDB running? ({e!s})"),
        )
    email = bleach.clean(payload.email, strip=True).lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a valid email address.")
    if db["users"].find_one({"email": email}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already registered.")

    role: RoleType = "pet_owner"
    raw_password = payload.password.strip() if isinstance(payload.password, str) else payload.password
    pw_error = validate_password_strength(raw_password, email=email)
    if pw_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_error)

    try:
        password_hash = hash_password(raw_password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_detail(f"Password processing failed (is bcrypt installed?): {e!s}"),
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
            detail=safe_detail(f"Registration could not be saved: {e!s}"),
        )
    return {"id": str(result.inserted_id), "email": email, "role": role}


@router.post("/login")
@limiter.limit(settings.auth_login_limit)
def login(request: Request, payload: LoginIn):
    try:
        db = get_db()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=safe_detail(f"Database connection failed. Is MongoDB running? ({e!s})"),
        )
    email = bleach.clean(payload.email, strip=True).lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a valid email address.")
    doc = db["users"].find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    stored_hash = doc.get("password_hash") or ""
    raw_password = payload.password.strip() if isinstance(payload.password, str) else payload.password
    try:
        ok = verify_password(raw_password, stored_hash)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_detail(f"Password verification failed (bcrypt?): {e!s}"),
        ) from e
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    role: RoleType = doc.get("role", "pet_owner")  # type: ignore[assignment]
    token = create_access_token(subject=email, extra_claims={"role": role})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=MeOut)
async def me(current=Depends(get_current_user)):
    try:
        db = get_db()
        return _me_out_from_db(db, current)
    except Exception:
        return MeOut(
            id=current["id"],
            email=current["email"],
            role=current["role"],
            full_name=None,
            clinic_id=None,
            clinic_name=None,
        )


@router.patch("/me", response_model=MeOut)
async def update_me(payload: MeUpdate, current=Depends(get_current_user)):
    """Update display name and (for pet owners) clinic membership."""
    db = get_db()
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    sets: dict = {}

    if "full_name" in data:
        sets["full_name"] = sanitize_optional_text(data.get("full_name"), 200)

    if "clinic_id" in data:
        if current["role"] != "pet_owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clinic selection is only available for pet owner accounts.",
            )
        raw = data.get("clinic_id")
        if raw is None or (isinstance(raw, str) and raw.strip() == ""):
            sets["clinic_id"] = None
        else:
            from app.utils.clinic_scope import approved_clinic_ids, clinic_exists

            try:
                coid = ObjectId(str(raw).strip())
            except Exception:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid clinic_id.")
            if not clinic_exists(db, coid):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found.")
            if coid not in approved_clinic_ids(db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This clinic is not open for selection yet (no approved veterinarian).",
                )
            sets["clinic_id"] = coid

    if sets:
        db["users"].update_one({"_id": ObjectId(current["id"])}, {"$set": sets})

    return _me_out_from_db(db, current)


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/change-password")
async def change_password(payload: ChangePasswordIn, current=Depends(get_current_user)):
    """Giriş yapmış kullanıcı mevcut parolasıyla yeni parola belirler."""
    db = get_db()
    user = db["users"].find_one({"_id": ObjectId(current["id"])})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    old = payload.old_password.strip()
    new = payload.new_password.strip()
    if not verify_password(old, user.get("password_hash") or ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    pw_error = validate_password_strength(new, email=current["email"])
    if pw_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_error)
    if verify_password(new, user.get("password_hash") or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current one.",
        )
    db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(new)}, "$unset": {"must_change_password": ""}},
    )
    return {"detail": "Password changed."}


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordIn):
    """Sıfırlama linki oluşturur. Kullanıcı sayımını önlemek için her zaman aynı yanıt döner."""
    db = get_db()
    email = bleach.clean(payload.email, strip=True).lower()
    generic = {"detail": "If an account exists for this email, a password reset link has been sent."}
    user = db["users"].find_one({"email": email}) if email else None
    if not user:
        return generic

    token = generate_reset_token()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.password_reset_expire_minutes)
    db["password_resets"].insert_one(
        {
            "user_id": user["_id"],
            "email": email,
            "token_hash": hash_token(token),
            "created_at": now,
            "expires_at": expires,
            "used": False,
        }
    )
    reset_link = f"{settings.app_base_url}/reset-password?token={token}"
    body = (
        "Hello,\n\n"
        "We received a request to reset your password. Open the link below to choose a new password:\n\n"
        f"{reset_link}\n\n"
        f"This link expires in {settings.password_reset_expire_minutes} minutes. "
        "If you did not request this, you can ignore this email.\n"
    )
    sent = send_email(email, "Password reset", body)

    resp = dict(generic)
    # Geliştirmede SMTP yoksa test edebilmek için linki yanıtta döndür.
    if not settings.is_production and not sent:
        resp["dev_reset_link"] = reset_link
    return resp


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, payload: ResetPasswordIn):
    """Token doğrulanırsa parolayı sıfırlar ve token'ı geçersiz kılar."""
    db = get_db()
    token_hash = hash_token(payload.token.strip())
    rec = db["password_resets"].find_one({"token_hash": token_hash})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already used reset link.")

    exp = rec.get("expires_at")
    if isinstance(exp, datetime) and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not exp or datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link has expired.")

    new = payload.new_password.strip()
    pw_error = validate_password_strength(new, email=rec.get("email"))
    if pw_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_error)

    db["users"].update_one(
        {"_id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(new)}, "$unset": {"must_change_password": ""}},
    )
    now = datetime.now(timezone.utc)
    db["password_resets"].update_one({"_id": rec["_id"]}, {"$set": {"used": True, "used_at": now}})
    # Aynı kullanıcının diğer bekleyen token'larını da geçersiz kıl.
    db["password_resets"].update_many(
        {"user_id": rec["user_id"], "used": False}, {"$set": {"used": True}}
    )
    return {"detail": "Your password has been reset. You can sign in with your new password."}
