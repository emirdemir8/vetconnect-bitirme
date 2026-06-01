from __future__ import annotations

import re

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.db.mongo import get_db
from app.utils.audit import record_audit
from app.utils.security import generate_temp_password, hash_password, require_role

router = APIRouter(prefix="/admin/users", tags=["admin"])


class AdminUserOut(BaseModel):
    id: str
    email: str
    role: str
    full_name: str | None = None


class ResetPasswordResult(BaseModel):
    id: str
    email: str
    temp_password: str


@router.get("", response_model=list[AdminUserOut])
def list_users(
    query: str = Query(default="", max_length=200),
    current=Depends(require_role("admin")),
):
    db = get_db()
    q: dict = {}
    term = (query or "").strip()
    if term:
        rx = re.escape(term)
        q = {
            "$or": [
                {"email": {"$regex": rx, "$options": "i"}},
                {"full_name": {"$regex": rx, "$options": "i"}},
            ]
        }
    cur = db["users"].find(q, {"email": 1, "role": 1, "full_name": 1}).sort("email", 1).limit(100)
    return [
        AdminUserOut(
            id=str(d["_id"]),
            email=d.get("email", ""),
            role=d.get("role", "pet_owner"),
            full_name=(d.get("full_name") or None),
        )
        for d in cur
    ]


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResult)
def admin_reset_password(user_id: str, current=Depends(require_role("admin"))):
    """Kullanıcıya geçici parola atar ve bir kez admin'e döndürür (kullanıcıya iletilir)."""
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id.")
    user = db["users"].find_one({"_id": oid}, {"email": 1})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    temp = generate_temp_password()
    db["users"].update_one(
        {"_id": oid},
        {"$set": {"password_hash": hash_password(temp), "must_change_password": True}},
    )
    # Bekleyen sıfırlama token'larını geçersiz kıl.
    db["password_resets"].update_many({"user_id": oid, "used": False}, {"$set": {"used": True}})

    record_audit(
        action="user.password_reset",
        actor_id=current.get("id"),
        actor_email=current.get("email"),
        target_type="user",
        target_id=str(oid),
    )
    return ResetPasswordResult(id=str(oid), email=user.get("email", ""), temp_password=temp)
