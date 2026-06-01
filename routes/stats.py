from __future__ import annotations

from fastapi import APIRouter, Depends

from app.db.mongo import get_db
from app.utils.clinic_scope import owner_user_ids_for_vet, pet_ids_owned_by
from app.utils.security import require_role


router = APIRouter(prefix="/stats", tags=["stats"])


def _empty_overview():
    return {
        "total_cases": 0,
        "serious_cases": 0,
        "non_serious_cases": 0,
        "by_risk_level": [],
    }


@router.get("/overview")
async def overview(current=Depends(require_role("vet", "admin"))):
    db = get_db()
    cases = db["cases"]
    query: dict = {}

    if current["role"] == "vet":
        owners = owner_user_ids_for_vet(db, current["id"])
        pids = pet_ids_owned_by(db, owners)
        if not pids:
            return _empty_overview()
        query["pet_id"] = {"$in": pids}

    total = cases.count_documents(query)
    serious = cases.count_documents({**query, "serious": True})
    non_serious = cases.count_documents({**query, "serious": False})

    match_stage = {"$match": query} if query else {"$match": {}}
    by_risk = list(
        cases.aggregate(
            [
                match_stage,
                {"$group": {"_id": "$risk_level", "count": {"$sum": 1}}},
                {"$sort": {"_id": 1}},
            ]
        )
    )

    return {
        "total_cases": total,
        "serious_cases": serious,
        "non_serious_cases": non_serious,
        "by_risk_level": [
            {"risk_level": d["_id"], "count": d["count"]} for d in by_risk if d["_id"] is not None
        ],
    }
