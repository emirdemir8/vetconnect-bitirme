from __future__ import annotations

from fastapi import APIRouter, Query

router = APIRouter(prefix="/vaccine-types", tags=["vaccine-types"])

VACCINE_TYPES = [
    {"id": "rabies", "name": "Rabies"},
    {"id": "dhpp", "name": "DHPP / DHLPP (Dog)"},
    {"id": "fvrcp", "name": "FVRCP (Cat)"},
    {"id": "felv", "name": "FeLV (Cat leukemia)"},
    {"id": "lyme", "name": "Lyme (Borrelia)"},
    {"id": "bordetella", "name": "Bordetella (Kennel cough)"},
    {"id": "leishmania", "name": "Leishmania"},
    {"id": "corona_dog", "name": "Canine coronavirus"},
    {"id": "parvovirus", "name": "Parvovirus"},
    {"id": "distemper", "name": "Distemper"},
    {"id": "hepatitis", "name": "Hepatitis (CAV)"},
    {"id": "leptospirosis", "name": "Leptospirosis"},
    {"id": "parainfluenza", "name": "Parainfluenza"},
    {"id": "tetanus", "name": "Tetanus"},
]

OTHER_VACCINE = {"id": "other", "name": "Other (not in list — type your own)"}


@router.get("")
def list_vaccine_types(q: str | None = Query(None, max_length=120)):
    """Vaccine types for owner/vet forms; optional ?q= filters catalog (Other is always included)."""
    items = list(VACCINE_TYPES)
    needle = (q or "").strip().lower()
    if needle:
        items = [
            v
            for v in items
            if needle in v["name"].lower() or needle in v["id"].replace("_", " ").lower()
        ]
    return {"items": [*items, OTHER_VACCINE]}
