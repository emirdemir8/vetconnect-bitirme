from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/vaccine-types", tags=["vaccine-types"])

# Yaygın aşı türleri; isteğe göre veritabanına taşınabilir
VACCINE_TYPES = [
    {"id": "kuduz", "name": "Kuduz (Rabies)"},
    {"id": "karma_kopek", "name": "Karma Aşı (Köpek - DHPPi/L)"},
    {"id": "karma_kedi", "name": "Karma Aşı (Kedi - FVRCP)"},
    {"id": "lösemi_kedi", "name": "Kedi Lösemisi (FeLV)"},
    {"id": "lyme", "name": "Lyme (Borrelia)"},
    {"id": "bordetella", "name": "Bordetella (Kennel Cough)"},
    {"id": "leishmania", "name": "Leishmania"},
    {"id": "corona_kopek", "name": "Köpek Coronavirus"},
    {"id": "parvovirus", "name": "Parvovirus"},
    {"id": "distemper", "name": "Distemper (Gençlik)"},
    {"id": "hepatit", "name": "Hepatit (CAV)"},
    {"id": "leptospiroz", "name": "Leptospiroz"},
    {"id": "parainfluenza", "name": "Parainfluenza"},
    {"id": "tetanoz", "name": "Tetanoz"},
]


@router.get("")
def list_vaccine_types():
    """Tüm aşı türlerini döndürür (sahip/vet formlarında seçim için)."""
    return {"items": VACCINE_TYPES}
