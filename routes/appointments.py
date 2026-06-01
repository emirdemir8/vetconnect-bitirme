from __future__ import annotations

from bson import ObjectId
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.mongo import get_db
from app.utils.sanitize import sanitize_optional_text
from app.utils.clinic_scope import owner_user_ids_for_vet, vet_may_access_owner
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
    query: dict = {}
    if current["role"] == "pet_owner":
        query["owner_id"] = current["id"]
    elif current["role"] == "vet":
        oids = owner_user_ids_for_vet(db, current["id"])
        if not oids:
            return []
        query["owner_id"] = {"$in": oids}
    cursor = col.find(query).sort("scheduled_at", 1).limit(200)
    docs = list(cursor)
    # For pet names
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only pet owners can create appointments")
    db = get_db()
    pets = db["pets"]
    try:
        oid = ObjectId(payload.pet_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pet_id")
    pet = pets.find_one({"_id": oid})
    if not pet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")
    if str(pet.get("owner_id")) != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This pet does not belong to you")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if current["role"] == "pet_owner" and str(doc.get("owner_id")) != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if current["role"] == "vet" and not vet_may_access_owner(db, current["id"], str(doc.get("owner_id", ""))):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This appointment is outside your clinic scope.")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if current["role"] == "pet_owner" and str(doc.get("owner_id")) != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if current["role"] == "vet" and not vet_may_access_owner(db, current["id"], str(doc.get("owner_id", ""))):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This appointment is outside your clinic scope.")
    updates = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "reason" in updates and updates["reason"] is not None:
        updates["reason"] = sanitize_optional_text(updates["reason"], 500) or ""
    if not updates:
        return _doc_to_public(doc)
    col.update_one({"_id": oid}, {"$set": updates})
    doc.update(updates)
    return _doc_to_public(doc)
