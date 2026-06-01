from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.db.mongo import get_db
from app.utils.clinic_scope import clinic_exists
from app.utils.sanitize import sanitize_optional_text
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/vet-applications", tags=["vet-applications"])
admin_router = APIRouter(prefix="/admin/vet-applications", tags=["admin"])


ApplicationStatus = Literal["pending", "approved", "rejected"]


class VetApplicationCreate(BaseModel):
    clinic_name: str = Field(min_length=2, max_length=200)
    license_reference: str = Field(min_length=2, max_length=120, description="SMVK / diploma / sicil referansı")
    notes: str | None = Field(default=None, max_length=2000)


class VetApplicationOut(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str | None
    clinic_name: str
    license_reference: str
    notes: str | None
    status: ApplicationStatus
    created_at: str
    reviewed_at: str | None = None
    reviewed_by: str | None = None
    reject_reason: str | None = None


class VetApplicationRejectIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class VetApplicationApproveIn(BaseModel):
    clinic_id: str = Field(..., min_length=24, max_length=24, description="Veterinerin atanacağı klinik ObjectId")


def _doc_to_out(doc: dict) -> VetApplicationOut:
    return VetApplicationOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        email=doc.get("email", ""),
        full_name=doc.get("full_name"),
        clinic_name=doc.get("clinic_name", ""),
        license_reference=doc.get("license_reference", ""),
        notes=doc.get("notes"),
        status=doc.get("status", "pending"),
        created_at=doc.get("created_at", ""),
        reviewed_at=doc.get("reviewed_at"),
        reviewed_by=doc.get("reviewed_by"),
        reject_reason=doc.get("reject_reason"),
    )


@router.post("", response_model=VetApplicationOut, status_code=status.HTTP_201_CREATED)
def submit_vet_application(payload: VetApplicationCreate, current=Depends(get_current_user)):
    """Pet owner veteriner paneli için başvuru oluşturur; admin onayından sonra rol vet olur."""
    if current["role"] != "pet_owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only pet owner accounts can submit vet applications.",
        )
    db = get_db()
    user_oid = ObjectId(current["id"])
    u = db["users"].find_one({"_id": user_oid}, {"role": 1})
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if u.get("role") == "vet":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You already have a vet account.")

    if db["vet_applications"].find_one({"user_id": user_oid, "status": "pending"}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending application. Wait until it is processed.",
        )

    now = datetime.now(timezone.utc).isoformat()
    clinic = sanitize_optional_text(payload.clinic_name, 200) or ""
    lic = sanitize_optional_text(payload.license_reference, 120) or ""
    notes = sanitize_optional_text(payload.notes, 2000)
    if len(clinic) < 2 or len(lic) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic name and reference must be at least 2 characters.")

    ufull = db["users"].find_one({"_id": user_oid}, {"full_name": 1, "email": 1})
    doc = {
        "user_id": user_oid,
        "email": (ufull or {}).get("email", current["email"]),
        "full_name": sanitize_optional_text((ufull or {}).get("full_name"), 200),
        "clinic_name": clinic,
        "license_reference": lic,
        "notes": notes,
        "status": "pending",
        "created_at": now,
        "reviewed_at": None,
        "reviewed_by": None,
        "reject_reason": None,
    }
    ins = db["vet_applications"].insert_one(doc)
    doc["_id"] = ins.inserted_id
    return _doc_to_out(doc)


@router.get("/me", response_model=VetApplicationOut | None)
def my_latest_vet_application(current=Depends(get_current_user)):
    """Giriş yapan kullanıcının en son veteriner başvurusu (yoksa null)."""
    db = get_db()
    doc = db["vet_applications"].find_one(
        {"user_id": ObjectId(current["id"])},
        sort=[("created_at", -1)],
    )
    return _doc_to_out(doc) if doc else None


@admin_router.get("", response_model=list[VetApplicationOut])
def admin_list_vet_applications(
    list_status: ApplicationStatus | Literal["all"] = Query(default="pending", alias="status"),
    current=Depends(require_role("admin")),
):
    db = get_db()
    q: dict = {}
    if list_status != "all":
        q["status"] = list_status
    cur = db["vet_applications"].find(q).sort("created_at", 1)
    return [_doc_to_out(d) for d in cur]


@admin_router.post("/{application_id}/approve", response_model=VetApplicationOut)
def admin_approve_vet_application(
    application_id: str,
    body: VetApplicationApproveIn,
    current=Depends(require_role("admin")),
):
    db = get_db()
    try:
        coid = ObjectId(body.clinic_id.strip())
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid clinic_id.")
    if not clinic_exists(db, coid):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found.")
    try:
        oid = ObjectId(application_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid application id.")
    app_doc = db["vet_applications"].find_one({"_id": oid, "status": "pending"})
    if not app_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending application not found or already processed.",
        )
    now = datetime.now(timezone.utc).isoformat()
    reviewer = current.get("email", "admin")
    user_oid = app_doc["user_id"]
    u = db["users"].find_one({"_id": user_oid}, {"role": 1})
    if not u:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Applicant user not found.")
    if u.get("role") == "vet":
        db["users"].update_one({"_id": user_oid}, {"$set": {"clinic_id": coid}})
        db["vet_applications"].update_one(
            {"_id": oid},
            {"$set": {"status": "approved", "reviewed_at": now, "reviewed_by": reviewer, "clinic_id": coid}},
        )
        fresh = db["vet_applications"].find_one({"_id": oid})
        return _doc_to_out(fresh)  # type: ignore[arg-type]

    r = db["users"].update_one(
        {"_id": user_oid, "role": "pet_owner"},
        {"$set": {"role": "vet", "clinic_id": coid}},
    )
    if r.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is not pet_owner or could not be updated.",
        )
    db["vet_applications"].update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "approved",
                "reviewed_at": now,
                "reviewed_by": reviewer,
                "reject_reason": None,
                "clinic_id": coid,
            }
        },
    )
    fresh = db["vet_applications"].find_one({"_id": oid})
    return _doc_to_out(fresh)  # type: ignore[arg-type]


@admin_router.post("/{application_id}/reject", response_model=VetApplicationOut)
def admin_reject_vet_application(
    application_id: str,
    payload: VetApplicationRejectIn,
    current=Depends(require_role("admin")),
):
    db = get_db()
    try:
        oid = ObjectId(application_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid application id.")
    app_doc = db["vet_applications"].find_one({"_id": oid, "status": "pending"})
    if not app_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending application not found or already processed.",
        )
    now = datetime.now(timezone.utc).isoformat()
    reviewer = current.get("email", "admin")
    reason = sanitize_optional_text(payload.reason, 500)
    db["vet_applications"].update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "rejected",
                "reviewed_at": now,
                "reviewed_by": reviewer,
                "reject_reason": reason,
            }
        },
    )
    fresh = db["vet_applications"].find_one({"_id": oid})
    return _doc_to_out(fresh)  # type: ignore[arg-type]
