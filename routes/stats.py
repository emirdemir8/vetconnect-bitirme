from __future__ import annotations

from fastapi import APIRouter, Depends

from app.db.mongo import get_db
from app.utils.security import require_role


router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
async def overview(current=Depends(require_role("vet", "admin"))):
    db = get_db()
    cases = db["cases"]

    total = cases.count_documents({})
    serious = cases.count_documents({"serious": True})
    non_serious = cases.count_documents({"serious": False})

    by_risk = list(
        cases.aggregate(
            [
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

