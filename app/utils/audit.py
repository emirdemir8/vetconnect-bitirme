from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db.mongo import get_db


def record_audit(
    *,
    action: str,
    actor_id: str | None = None,
    actor_email: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Writes sensitive/privileged operations to the audit_logs collection.

    An audit record must never break the main workflow; errors are silently swallowed.
    """
    try:
        db = get_db()
        db["audit_logs"].insert_one(
            {
                "action": action,
                "actor_id": actor_id,
                "actor_email": actor_email,
                "target_type": target_type,
                "target_id": target_id,
                "metadata": metadata or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:
        pass
