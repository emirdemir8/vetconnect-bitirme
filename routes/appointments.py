from __future__ import annotations

from bson import ObjectId
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.mongo import get_db
from app.utils.sanitize import sanitize_optional_text
from app.utils.security import get_current_user
from models.appointment import AppointmentCreate, AppointmentPublic, AppointmentUpdate

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _doc_to_public(doc, pets_by_id=None) -> AppointmentPublic:
    pet_id = str(doc.get("pet_id", ""))
    pet_name = None
    if pets_by_id and pet_id in pets_by_id:
        pet_name = pets_by_id[pet_id].get("name")
    return AppointmentPublic(
        id=str(doc["_id"]),
        owner_id=str(doc.get("owner_id", "")),
        pet_id=pet_id,
        scheduled_at=doc.get("scheduled_at"),
        reason=doc.get("reason", ""),
        status=doc.get("status", "pending"),
        created_at=doc.get("created_at"),
        pet_name=pet_name,
    )


@router.get("", response_model=list[AppointmentPublic])
async def list_appointments(current=Depends(get_current_user)):
    db = get_db()
    col = db["appointments"]
    query = {}
    if current["role"] == "pet_owner":
        query["owner_id"] = current["id"]
    cursor = col.find(query).sort("scheduled_at", 1).limit(200)
    docs = list(cursor)
    # Pet isimleri için
    pet_ids = list({str(d.get("pet_id")) for d in docs if d.get("pet_id")})
    pets_by_id = {}
    for pid in pet_ids:
        try:
            p = db["pets"].find_one({"_id": ObjectId(pid)})
            if p:
                pets_by_id[pid] = p
        except Exception:
            pass
    return [_doc_to_public(d, pets_by_id) for d in docs]


@router.post("", response_model=AppointmentPublic, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    current=Depends(get_current_user),
):
    if current["role"] != "pet_owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sadece evcil hayvan sahibi randevu oluşturabilir")
    db = get_db()
    pets = db["pets"]
    try:
        oid = ObjectId(payload.pet_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz pet_id")
    pet = pets.find_one({"_id": oid})
    if not pet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evcil hayvan bulunamadı")
    if str(pet.get("owner_id")) != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu hayvan size ait değil")
    now = datetime.now(timezone.utc)
    doc = {
        "owner_id": current["id"],
        "pet_id": payload.pet_id,
        "scheduled_at": payload.scheduled_at,
        "reason": sanitize_optional_text(payload.reason, 500) or "",
        "status": "pending",
        "created_at": now,
    }
    col = db["appointments"]
    result = col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_public(doc, {payload.pet_id: pet})


@router.get("/{appointment_id}", response_model=AppointmentPublic)
async def get_appointment(appointment_id: str, current=Depends(get_current_user)):
    db = get_db()
    col = db["appointments"]
    try:
        oid = ObjectId(appointment_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Randevu bulunamadı")
    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Randevu bulunamadı")
    if current["role"] == "pet_owner" and str(doc.get("owner_id")) != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz")
    return _doc_to_public(doc)


@router.patch("/{appointment_id}", response_model=AppointmentPublic)
async def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    current=Depends(get_current_user),
):
    db = get_db()
    col = db["appointments"]
    try:
        oid = ObjectId(appointment_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Randevu bulunamadı")
    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Randevu bulunamadı")
    if current["role"] == "pet_owner" and str(doc.get("owner_id")) != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz")
    updates = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "reason" in updates and updates["reason"] is not None:
        updates["reason"] = sanitize_optional_text(updates["reason"], 500) or ""
    if not updates:
        return _doc_to_public(doc)
    col.update_one({"_id": oid}, {"$set": updates})
    doc.update(updates)
    return _doc_to_public(doc)
