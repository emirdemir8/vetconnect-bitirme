from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.mongo import get_db
from app.utils.sanitize import sanitize_optional_text, sanitize_text
from app.utils.security import get_current_user, require_role
from models.symptom_report import (
    SymptomReportCreate,
    SymptomReportPublic,
    SymptomReportVetFeedback,
)

router = APIRouter(prefix="/symptom-reports", tags=["symptom-reports"])


def _to_public(
    doc: dict,
    pet_name: str | None = None,
    owner_name: str | None = None,
    owner_email: str | None = None,
) -> SymptomReportPublic:
    return SymptomReportPublic(
        id=str(doc["_id"]),
        owner_id=str(doc.get("owner_id", "")),
        pet_id=str(doc.get("pet_id", "")),
        animal_species=doc.get("animal_species"),
        product_or_vaccine=doc.get("product_or_vaccine"),
        symptoms=doc.get("symptoms", []),
        free_text=doc.get("free_text"),
        adr_no=doc.get("adr_no"),
        system_serious=doc.get("system_serious", False),
        system_risk_level=doc.get("system_risk_level"),
        system_risk_label=doc.get("system_risk_label"),
        system_reasons=doc.get("system_reasons", []),
        system_inferred_symptoms=doc.get("system_inferred_symptoms", []),
        system_matched_symptoms=doc.get("system_matched_symptoms", []),
        system_matched_records=doc.get("system_matched_records", 0),
        created_at=doc.get("created_at"),
        vet_feedback=doc.get("vet_feedback"),
        vet_feedback_at=doc.get("vet_feedback_at"),
        pet_name=pet_name,
        owner_name=owner_name,
        owner_email=owner_email,
    )


@router.post("", response_model=SymptomReportPublic, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: SymptomReportCreate,
    current=Depends(get_current_user),
):
    """Evcil hayvan sahibi ön kontrolden sonra bildirimi kaydeder."""
    if current["role"] != "pet_owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sadece evcil hayvan sahibi bildirim oluşturabilir.")

    db = get_db()
    pets = db["pets"]
    pet = pets.find_one({"_id": ObjectId(payload.pet_id)})
    if not pet or pet.get("owner_id") != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu evcil hayvana erişim yok.")

    now = datetime.now(timezone.utc)
    symptoms_clean = [sanitize_text(s, 200) or "" for s in (payload.symptoms or []) if s]
    doc = {
        "owner_id": current["id"],
        "pet_id": payload.pet_id,
        "animal_species": sanitize_optional_text(payload.animal_species, 50),
        "product_or_vaccine": sanitize_optional_text(payload.product_or_vaccine, 200),
        "symptoms": symptoms_clean,
        "free_text": sanitize_optional_text(payload.free_text, 2000),
        "adr_no": sanitize_optional_text(payload.adr_no, 50),
        "system_serious": payload.system_serious,
        "system_risk_level": payload.system_risk_level,
        "system_risk_label": payload.system_risk_label,
        "system_reasons": payload.system_reasons,
        "system_inferred_symptoms": payload.system_inferred_symptoms,
        "system_matched_symptoms": payload.system_matched_symptoms,
        "system_matched_records": payload.system_matched_records,
        "created_at": now,
        "vet_feedback": None,
        "vet_feedback_at": None,
    }
    result = db["symptom_reports"].insert_one(doc)
    doc["_id"] = result.inserted_id
    pet_name = pet.get("name") or ""
    return _to_public(doc, pet_name=pet_name, owner_name=None, owner_email=None)


@router.get("", response_model=list[SymptomReportPublic])
async def list_reports(
    limit: int = Query(100, ge=1, le=500),
    current=Depends(get_current_user),
):
    """Vet tüm sahip bildirimlerini görür; owner sadece kendi bildirimlerini."""
    db = get_db()
    col = db["symptom_reports"]
    query: dict = {}

    if current["role"] == "pet_owner":
        query["owner_id"] = current["id"]
    # vet/admin: query boş, hepsini listele

    docs = list(col.find(query).sort("created_at", -1).limit(limit))
    pets = {str(p["_id"]): p for p in db["pets"].find({}, {"name": 1})}
    # Vet için sadece sahip adı (full_name), e-posta gönderilmez
    users: dict[str, dict] = {}
    if current["role"] in ("vet", "admin"):
        for d in docs:
            oid = d.get("owner_id")
            if not oid or str(oid) in users:
                continue
            try:
                u = db["users"].find_one({"_id": ObjectId(str(oid))}, {"full_name": 1})
                if u:
                    fn = (u.get("full_name") or "").strip() or None
                    users[str(oid)] = {"owner_name": fn}
            except Exception:
                pass

    out = []
    for d in docs:
        pet = pets.get(str(d.get("pet_id", "")))
        pet_name = (pet.get("name") or "") if pet else ""
        owner_id = str(d.get("owner_id", ""))
        if current["role"] in ("vet", "admin"):
            owner_name = users.get(owner_id, {}).get("owner_name") if owner_id else None
            out.append(_to_public(d, pet_name=pet_name, owner_name=owner_name, owner_email=None))
        else:
            out.append(_to_public(d, pet_name=pet_name, owner_name=None, owner_email=None))
    return out


@router.patch("/{report_id}", response_model=SymptomReportPublic)
async def set_vet_feedback(
    report_id: str,
    payload: SymptomReportVetFeedback,
    current=Depends(require_role("vet", "admin")),
):
    """Veteriner bildirime geri bildirim ekler."""
    db = get_db()
    col = db["symptom_reports"]
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bildirim bulunamadı.")

    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bildirim bulunamadı.")

    now = datetime.now(timezone.utc)
    vet_feedback_clean = sanitize_text(payload.vet_feedback, 2000) or ""
    col.update_one(
        {"_id": oid},
        {"$set": {"vet_feedback": vet_feedback_clean, "vet_feedback_at": now}},
    )
    doc["vet_feedback"] = vet_feedback_clean
    doc["vet_feedback_at"] = now

    pets = {str(p["_id"]): p for p in db["pets"].find({}, {"name": 1})}
    pet = pets.get(str(doc.get("pet_id", "")))
    pet_name = (pet.get("name") or "") if pet else ""
    owner_id = str(doc.get("owner_id", ""))
    u = db["users"].find_one({"_id": ObjectId(owner_id)}, {"full_name": 1}) if owner_id else None
    owner_name = (u.get("full_name") or "").strip() or None if u else None
    return _to_public(doc, pet_name=pet_name, owner_name=owner_name, owner_email=None)
