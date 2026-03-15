from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.mongo import get_db
from app.utils.sanitize import sanitize_optional_text, sanitize_text
from app.utils.security import get_current_user, require_role
from models.case import CaseCreate, CasePublic, CaseUpdate
from routes.vet import SymptomCheckRequest, check_serious


router = APIRouter(prefix="/cases", tags=["cases"])


def _to_case_public(doc) -> CasePublic:
    return CasePublic(
        id=str(doc["_id"]),
        pet_id=str(doc.get("pet_id")),
        adr_no=doc.get("adr_no"),
        symptoms=doc.get("symptoms", []),
        vet_notes=doc.get("vet_notes"),
        status=doc.get("status", "open"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        risk_level=doc.get("risk_level"),
        risk_label=doc.get("risk_label"),
        serious=doc.get("serious"),
    )


@router.post("", response_model=CasePublic, status_code=status.HTTP_201_CREATED)
async def create_case(
    payload: CaseCreate,
    current=Depends(require_role("vet", "admin")),
):
    db = get_db()
    col = db["cases"]

    symptoms_clean = [sanitize_text(s, 200) or "" for s in (payload.symptoms or []) if s]
    risk_req = SymptomCheckRequest(symptoms=symptoms_clean, adr_no=sanitize_optional_text(payload.adr_no, 50))
    risk_res = check_serious(risk_req)

    now = datetime.now(timezone.utc)
    doc = {
        "pet_id": payload.pet_id,
        "adr_no": sanitize_optional_text(payload.adr_no, 50),
        "symptoms": symptoms_clean,
        "vet_notes": sanitize_optional_text(payload.vet_notes, 4000),
        "status": payload.status,
        "created_at": now,
        "updated_at": now,
        "risk_level": risk_res.risk_level,
        "risk_label": risk_res.risk_label,
        "serious": risk_res.serious,
    }
    result = col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_case_public(doc)


@router.get("", response_model=list[CasePublic])
async def list_cases(
    limit: int = Query(100, ge=1, le=500),
    serious: bool | None = None,
    current=Depends(get_current_user),
):
    db = get_db()
    col = db["cases"]
    query: dict = {}
    if serious is not None:
        query["serious"] = serious

    # Pet owner ise sadece kendi pet'lerine ait vakaları görebilsin
    if current["role"] == "pet_owner":
        pet_ids = [
            str(p["_id"])
            for p in db["pets"].find({"owner_id": current["id"]}, {"_id": 1}).limit(500)
        ]
        if not pet_ids:
            return []
        query["pet_id"] = {"$in": pet_ids}

    docs = col.find(query).sort("created_at", -1).limit(limit)
    return [_to_case_public(d) for d in docs]


@router.get("/{case_id}", response_model=CasePublic)
async def get_case(case_id: str, current=Depends(get_current_user)):
    db = get_db()
    col = db["cases"]
    try:
        oid = ObjectId(case_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Pet owner ise sahip olmadığı pet'in vakasını göremesin
    if current["role"] == "pet_owner":
        pet = db["pets"].find_one({"_id": ObjectId(doc["pet_id"])})
        if not pet or pet.get("owner_id") != current["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim")

    return _to_case_public(doc)


@router.put("/{case_id}", response_model=CasePublic)
async def update_case(
    case_id: str,
    payload: CaseUpdate,
    current=Depends(require_role("vet", "admin")),
):
    db = get_db()
    col = db["cases"]
    try:
        oid = ObjectId(case_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    updates = payload.dict(exclude_unset=True)
    if "symptoms" in updates and updates["symptoms"] is not None:
        updates["symptoms"] = [sanitize_text(s, 200) or "" for s in updates["symptoms"] if s]
    if "vet_notes" in updates and updates["vet_notes"] is not None:
        updates["vet_notes"] = sanitize_optional_text(updates["vet_notes"], 4000)
    if "adr_no" in updates:
        updates["adr_no"] = sanitize_optional_text(updates.get("adr_no"), 50)

    symptoms = updates.get("symptoms", doc.get("symptoms"))
    adr_no = updates.get("adr_no", doc.get("adr_no"))
    risk_level = doc.get("risk_level")
    risk_label = doc.get("risk_label")
    serious = doc.get("serious")

    if "symptoms" in updates:
        risk_req = SymptomCheckRequest(symptoms=symptoms, adr_no=adr_no)
        risk_res = check_serious(risk_req)
        risk_level = risk_res.risk_level
        risk_label = risk_res.risk_label
        serious = risk_res.serious

    updates["updated_at"] = datetime.now(timezone.utc)
    updates["risk_level"] = risk_level
    updates["risk_label"] = risk_label
    updates["serious"] = serious

    col.update_one({"_id": oid}, {"$set": updates})
    doc.update(updates)
    return _to_case_public(doc)

