from __future__ import annotations

from bson import ObjectId
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.mongo import get_db
from app.utils.sanitize import sanitize_image_url, sanitize_optional_text, sanitize_text
from app.utils.security import get_current_user
from models.pet import PetCreate, PetPublic, PetUpdate, VaccineEntry


router = APIRouter(prefix="/pets", tags=["pets"])


def _serialize_vaccine_history(history: list | None) -> list[dict]:
    if not history:
        return []
    out = []
    for e in history:
        if isinstance(e, dict):
            va = e.get("vaccinated_at")
            if hasattr(va, "isoformat"):
                va = va.isoformat()
            out.append({
                "vaccine_type": e.get("vaccine_type", ""),
                "status": e.get("status", "done"),
                "vaccinated_at": va,
            })
        else:
            va = getattr(e, "vaccinated_at", None)
            if hasattr(va, "isoformat"):
                va = va.isoformat()
            out.append({
                "vaccine_type": getattr(e, "vaccine_type", ""),
                "status": getattr(e, "status", "done"),
                "vaccinated_at": va,
            })
    return out


def _normalize_vaccinated_at(va) -> date_type | None:
    if va is None:
        return None
    if hasattr(va, "isoformat"):
        return va
    if isinstance(va, str) and len(va) >= 10:
        try:
            return date_type.fromisoformat(va[:10])
        except (ValueError, TypeError):
            return None
    return None


def _to_pet_public(doc, owner_email: str | None = None, owner_name: str | None = None) -> PetPublic:
    vh = doc.get("vaccine_history") or []
    vaccine_history = []
    for e in vh:
        vt = e.get("vaccine_type", "")
        if not vt:
            continue
        va = _normalize_vaccinated_at(e.get("vaccinated_at"))
        st = e.get("status", "done" if va else "planned")
        try:
            vaccine_history.append(VaccineEntry(vaccine_type=vt, status=st, vaccinated_at=va))
        except Exception:
            vaccine_history.append(VaccineEntry(vaccine_type=vt, status="planned", vaccinated_at=va))
    return PetPublic(
        id=str(doc["_id"]),
        owner_id=str(doc.get("owner_id")) if doc.get("owner_id") else None,
        name=doc.get("name", ""),
        species=doc.get("species", ""),
        breed=doc.get("breed"),
        sex=doc.get("sex"),
        date_of_birth=doc.get("date_of_birth"),
        weight_kg=doc.get("weight_kg"),
        microchip=doc.get("microchip"),
        vaccine_history=vaccine_history,
        notes=doc.get("notes"),
        card_color=doc.get("card_color"),
        avatar_emoji=doc.get("avatar_emoji"),
        image_url=doc.get("image_url"),
        owner_email=owner_email,
        owner_name=owner_name,
    )


def _get_owner_map(db, owner_ids: list[str]) -> dict[str, dict]:
    """owner_id -> { full_name } (veteriner panelinde sadece sahip adı; e-posta gönderilmez)."""
    if not owner_ids:
        return {}
    from bson import ObjectId
    users_col = db["users"]
    result = {}
    for oid in owner_ids:
        if not oid or oid in result:
            continue
        try:
            u = users_col.find_one({"_id": ObjectId(oid)}, {"full_name": 1})
            if u:
                result[oid] = {
                    "full_name": (u.get("full_name") or "").strip() or None,
                }
        except Exception:
            pass
    return result


@router.get("", response_model=list[PetPublic])
async def list_pets(current=Depends(get_current_user)):
    db = get_db()
    col = db["pets"]
    query = {}
    # Pet owner ise sadece kendi pet'lerini görsün
    if current["role"] == "pet_owner":
        query["owner_id"] = current["id"]
    docs = list(col.find(query).limit(500))
    owner_ids = list({str(d.get("owner_id")) for d in docs if d.get("owner_id")})
    owner_map = _get_owner_map(db, owner_ids)
    out = []
    for d in docs:
        oid = str(d.get("owner_id")) if d.get("owner_id") else None
        info = owner_map.get(oid, {}) if oid else {}
        name = info.get("full_name") or None
        out.append(_to_pet_public(d, owner_email=None, owner_name=name))
    return out


@router.post("", response_model=PetPublic, status_code=status.HTTP_201_CREATED)
async def create_pet(
    payload: PetCreate,
    current=Depends(get_current_user),
):
    db = get_db()
    col = db["pets"]

    owner_id: str | None = payload.owner_id
    if current["role"] == "pet_owner":
        owner_id = current["id"]

    doc = {
        "name": sanitize_text(payload.name, 100) or "",
        "species": sanitize_text(payload.species, 50) or "",
        "breed": sanitize_optional_text(payload.breed, 100),
        "sex": sanitize_optional_text(payload.sex, 10),
        "date_of_birth": payload.date_of_birth,
        "card_color": sanitize_optional_text(payload.card_color, 20),
        "avatar_emoji": sanitize_optional_text(payload.avatar_emoji, 10),
        "weight_kg": payload.weight_kg,
        "microchip": sanitize_optional_text(payload.microchip, 50),
        "vaccine_history": _serialize_vaccine_history(payload.vaccine_history),
        "notes": sanitize_optional_text(payload.notes, 2000),
        "image_url": sanitize_image_url(getattr(payload, "image_url", None)),
        "owner_id": owner_id,
    }
    result = col.insert_one(doc)
    doc["_id"] = result.inserted_id
    owner_name = None
    if owner_id:
        owner_map = _get_owner_map(db, [owner_id])
        owner_name = owner_map.get(owner_id, {}).get("full_name")
    return _to_pet_public(doc, owner_email=None, owner_name=owner_name)


@router.get("/{pet_id}", response_model=PetPublic)
async def get_pet(pet_id: str, current=Depends(get_current_user)):
    db = get_db()
    col = db["pets"]
    try:
        oid = ObjectId(pet_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")

    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")

    if current["role"] == "pet_owner" and doc.get("owner_id") != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim")

    owner_name = None
    oid = str(doc.get("owner_id")) if doc.get("owner_id") else None
    if oid:
        owner_map = _get_owner_map(db, [oid])
        owner_name = owner_map.get(oid, {}).get("full_name")
    return _to_pet_public(doc, owner_email=None, owner_name=owner_name)


@router.put("/{pet_id}", response_model=PetPublic)
async def update_pet(pet_id: str, payload: PetUpdate, current=Depends(get_current_user)):
    db = get_db()
    col = db["pets"]
    try:
        oid = ObjectId(pet_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")

    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")

    if current["role"] == "pet_owner" and doc.get("owner_id") != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim")

    updates = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "vaccine_history" in updates and updates["vaccine_history"] is not None:
        updates["vaccine_history"] = _serialize_vaccine_history(updates["vaccine_history"])
    # Sanitize string inputs
    if "name" in updates and updates["name"] is not None:
        updates["name"] = sanitize_text(updates["name"], 100) or ""
    if "species" in updates and updates["species"] is not None:
        updates["species"] = sanitize_text(updates["species"], 50) or ""
    for key in ("breed", "sex", "microchip", "notes", "card_color", "avatar_emoji"):
        if key in updates and updates[key] is not None:
            updates[key] = sanitize_optional_text(updates[key], 2000 if key == "notes" else 100 if key == "breed" else 50 if key == "microchip" else 20 if key == "card_color" else 10)
    if "image_url" in updates:
        updates["image_url"] = sanitize_image_url(updates.get("image_url"))

    def _with_owner(p):
        oid2 = str(p.get("owner_id")) if p.get("owner_id") else None
        if not oid2:
            return _to_pet_public(p, owner_email=None, owner_name=None)
        om = _get_owner_map(db, [oid2])
        owner_name = om.get(oid2, {}).get("full_name")
        return _to_pet_public(p, owner_email=None, owner_name=owner_name)

    if not updates:
        return _with_owner(doc)

    col.update_one({"_id": oid}, {"$set": updates})
    doc.update(updates)
    return _with_owner(doc)


@router.delete("/{pet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pet(pet_id: str, current=Depends(get_current_user)):
    db = get_db()
    col = db["pets"]
    try:
        oid = ObjectId(pet_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")

    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")

    if current["role"] == "pet_owner" and doc.get("owner_id") != current["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim")

    col.delete_one({"_id": oid})
    return None

