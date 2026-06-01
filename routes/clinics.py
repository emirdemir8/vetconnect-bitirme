from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.db.mongo import get_db
from app.utils.clinic_membership import build_clinic_membership_options
from app.utils.clinic_scope import approved_clinic_ids, normalize_network_key
from app.utils.sanitize import sanitize_text
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/clinics", tags=["clinics"])


class ClinicOut(BaseModel):
    id: str
    name: str
    network_key: str | None = None


class ClinicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    network_key: str | None = Field(
        default=None,
        max_length=40,
        description="Opsiyonel ağ etiketi (örn. paws). Aynı etiketli kliniklerde vet verileri paylaşılır.",
    )


class ClinicMembershipOptionOut(BaseModel):
    """Sahip üyeliği: ağ altındaki şubeler tek seçenek."""
    clinic_id: str
    display_name: str
    subtitle: str = ""
    network_key: str | None = None
    branch_count: int = 1
    branch_clinic_ids: list[str] = []


@router.get("/membership-options", response_model=list[ClinicMembershipOptionOut])
def list_membership_options(current=Depends(get_current_user)):
    """Pet sahibi klinik seçerken aynı ağdaki şubeler birleşik listelenir."""
    db = get_db()
    return build_clinic_membership_options(db)


@router.get("", response_model=list[ClinicOut])
def list_clinics(current=Depends(get_current_user)):
    """Klinik listesi.

    Admin tüm klinikleri görür (başvuru onayında atama için); diğer kullanıcılar
    yalnızca admin onaylı bir veterineri olan klinikleri görür.
    """
    db = get_db()
    query: dict = {}
    if current["role"] != "admin":
        approved = approved_clinic_ids(db)
        if not approved:
            return []
        query = {"_id": {"$in": list(approved)}}
    cur = db["clinics"].find(query).sort("name", 1).limit(200)
    return [
        ClinicOut(
            id=str(d["_id"]),
            name=d.get("name", ""),
            network_key=d.get("network_key"),
        )
        for d in cur
    ]


@router.post("", response_model=ClinicOut, status_code=status.HTTP_201_CREATED)
def create_clinic(payload: ClinicCreate, current=Depends(require_role("admin"))):
    db = get_db()
    name = sanitize_text(payload.name, 200) or ""
    if len(name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clinic name must be at least 2 characters.")
    nk = normalize_network_key(payload.network_key)
    now = datetime.now(timezone.utc).isoformat()
    doc: dict = {"name": name, "created_at": now}
    if nk:
        doc["network_key"] = nk
    try:
        ins = db["clinics"].insert_one(doc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Could not add clinic (duplicate name?): {e!s}",
        )
    doc["_id"] = ins.inserted_id
    return ClinicOut(id=str(ins.inserted_id), name=name, network_key=nk)
