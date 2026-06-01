from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId


def _oid(s: str | None) -> ObjectId | None:
    if not s:
        return None
    try:
        return ObjectId(str(s))
    except InvalidId:
        return None


def clinic_exists(db, clinic_id: ObjectId) -> bool:
    return db["clinics"].find_one({"_id": clinic_id}, {"_id": 1}) is not None


def user_clinic_id(db, user_id: str) -> ObjectId | None:
    oid = _oid(user_id)
    if not oid:
        return None
    u = db["users"].find_one({"_id": oid}, {"clinic_id": 1})
    if not u:
        return None
    cid = u.get("clinic_id")
    if isinstance(cid, ObjectId):
        return cid
    return _oid(str(cid)) if cid else None


def clinic_ids_in_vet_scope(db, vet_clinic_id: ObjectId) -> list[ObjectId]:
    """
    Vet'in bağlı olduğu klinik kaydından ağ (network_key) okunur.
    Aynı network_key'e sahip tüm klinik id'leri döner; network_key yoksa yalnızca o klinik.
    """
    c = db["clinics"].find_one({"_id": vet_clinic_id}, {"network_key": 1})
    if not c:
        return []
    nk = (c.get("network_key") or "").strip()
    if nk:
        return [doc["_id"] for doc in db["clinics"].find({"network_key": nk}, {"_id": 1})]
    return [vet_clinic_id]


def owner_user_ids_for_vet(db, vet_user_id: str) -> list[str]:
    """Vet'in görebileceği pet_owner id'leri (aynı klinik veya aynı network_key altındaki şubeler)."""
    cid = user_clinic_id(db, vet_user_id)
    if not cid:
        return []
    cids = clinic_ids_in_vet_scope(db, cid)
    return [
        str(u["_id"])
        for u in db["users"].find({"clinic_id": {"$in": cids}, "role": "pet_owner"}, {"_id": 1})
    ]


def owner_user_ids_in_clinic(db, clinic_id: ObjectId) -> list[str]:
    """Yalnızca tek klinik (network kullanmadan)."""
    return [
        str(u["_id"])
        for u in db["users"].find({"clinic_id": clinic_id, "role": "pet_owner"}, {"_id": 1})
    ]


def pet_ids_owned_by(db, owner_id_strs: list[str]) -> list[str]:
    if not owner_id_strs:
        return []
    out: list[str] = []
    for oid_s in owner_id_strs:
        try:
            ObjectId(oid_s)
        except InvalidId:
            continue
        for p in db["pets"].find({"owner_id": oid_s}, {"_id": 1}):
            out.append(str(p["_id"]))
    return out


def vet_may_access_pet(db, vet_user_id: str, pet_doc: dict) -> bool:
    vc = user_clinic_id(db, vet_user_id)
    if not vc:
        return False
    owner_id = pet_doc.get("owner_id")
    if not owner_id:
        return False
    oc = user_clinic_id(db, str(owner_id))
    if not oc:
        return False
    allowed = clinic_ids_in_vet_scope(db, vc)
    return oc in allowed


def vet_may_access_owner(db, vet_user_id: str, owner_id_str: str) -> bool:
    vc = user_clinic_id(db, vet_user_id)
    oc = user_clinic_id(db, owner_id_str)
    if not vc or not oc:
        return False
    return oc in clinic_ids_in_vet_scope(db, vc)
