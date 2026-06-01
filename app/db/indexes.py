from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.db.mongo import get_db

log = logging.getLogger(__name__)


def _seed_default_clinics() -> None:
    """İlk kurulum: boş DB'de Paws ağı altında örnek şubeler."""
    db = get_db()
    if db["clinics"].count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    nk = "paws"
    db["clinics"].insert_many(
        [
            {"name": "Paws Central Clinic", "created_at": now, "network_key": nk},
            {"name": "Paws Branch Clinic", "created_at": now, "network_key": nk},
            {"name": "Paws — Downtown", "created_at": now, "network_key": nk},
            {"name": "Paws — North", "created_at": now, "network_key": nk},
            {"name": "Paws — West", "created_at": now, "network_key": nk},
        ]
    )


def sync_clinic_networks() -> None:
    """
    Mevcut veritabanı: bilinen klinikleri 'paws' ağına etiketler, eksik şubeleri ekler.
    Her başlangıçta idempotent çalışır.
    """
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    for name in ("Paws Central Clinic", "Paws Branch Clinic"):
        db["clinics"].update_one({"name": name}, {"$set": {"network_key": "paws"}})
    for name in ("Paws — Downtown", "Paws — North", "Paws — West"):
        existing = db["clinics"].find_one({"name": name})
        if existing:
            db["clinics"].update_one({"_id": existing["_id"]}, {"$set": {"network_key": "paws"}})
        else:
            try:
                db["clinics"].insert_one({"name": name, "created_at": now, "network_key": "paws"})
            except Exception as e:
                log.warning("Klinik eklenemedi %s: %s", name, e)


def ensure_indexes() -> None:
    """Uygulama başlarken idempotent indeksler (email tekilliği vb.)."""
    db = get_db()
    _seed_default_clinics()
    sync_clinic_networks()
    try:
        db["users"].create_index("email", unique=True)
    except Exception as e:
        log.warning(
            "users.email unique index oluşturulamadı (yinelenen kayıt veya izin hatası olabilir): %s",
            e,
        )
    try:
        db["clinics"].create_index("name", unique=True)
    except Exception as e:
        log.warning("clinics.name unique index: %s", e)
    try:
        db["clinics"].create_index("network_key")
    except Exception as e:
        log.warning("clinics.network_key index: %s", e)
    try:
        db["vet_applications"].create_index(
            [("user_id", 1)],
            unique=True,
            partialFilterExpression={"status": "pending"},
            name="vet_app_one_pending_per_user",
        )
    except Exception as e:
        log.warning("vet_applications kısmi tekil indeks oluşturulamadı: %s", e)
