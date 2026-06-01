"""Owner membership selection: clinic options grouped by network (network_key)."""
from __future__ import annotations

from collections import defaultdict


def build_clinic_membership_options(db) -> list[dict]:
    """
    Clinics sharing the same network_key are shown on a single row.
    The clinic_id written to the owner record: the alphabetically first branch in the group (consistent canonical).

    Only clinics that have an admin-approved veterinarian (clinic owner) are listed;
    empty/unapproved clinics are not shown to pet owners.
    """
    from app.utils.clinic_scope import approved_clinic_ids

    approved = approved_clinic_ids(db)
    if not approved:
        return []
    clinics = [c for c in db["clinics"].find({}).sort("name", 1) if c["_id"] in approved]
    by_nk: dict[str, list] = defaultdict(list)
    solo: list = []
    for c in clinics:
        nk = (c.get("network_key") or "").strip()
        if nk:
            by_nk[nk].append(c)
        else:
            solo.append(c)

    out: list[dict] = []
    for nk in sorted(by_nk.keys(), key=str.lower):
        group = sorted(by_nk[nk], key=lambda d: (d.get("name") or "").lower())
        primary = group[0]
        oid = primary["_id"]
        names_join = ", ".join((d.get("name") or "").strip() for d in group if d.get("name"))
        if len(group) == 1:
            display = group[0].get("name") or nk
            subtitle = ""
        else:
            display = f"{nk.replace('_', ' ').title()} — {len(group)} branches"
            subtitle = names_join
        out.append(
            {
                "clinic_id": str(oid),
                "display_name": display,
                "subtitle": subtitle,
                "network_key": nk,
                "branch_count": len(group),
                "branch_clinic_ids": [str(d["_id"]) for d in group],
            }
        )

    for c in sorted(solo, key=lambda d: (d.get("name") or "").lower()):
        nm = c.get("name") or ""
        oid = c["_id"]
        cid = str(oid)
        out.append(
            {
                "clinic_id": cid,
                "display_name": nm,
                "subtitle": "",
                "network_key": None,
                "branch_count": 1,
                "branch_clinic_ids": [cid],
            }
        )

    out.sort(key=lambda x: (x["display_name"] or "").lower())
    return out
