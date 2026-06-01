"""
Creates a veterinarian or admin user in a trusted environment (the registration API now only creates pet_owner).

Example:
  python scripts/create_vet_user.py --email vet@clinic.com --password "StrongPass123"
  python scripts/create_vet_user.py --email admin@site.com --password "..." --role admin
"""
from __future__ import annotations

import argparse
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import bleach  # noqa: E402

from bson import ObjectId  # noqa: E402

from app.db.mongo import get_db  # noqa: E402
from app.utils.security import hash_password  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description="Add a vet or admin user")
    p.add_argument("--email", required=True, help="Email (normalized to lowercase)")
    p.add_argument("--password", required=True, help="Plain-text password (stored with bcrypt)")
    p.add_argument("--role", default="vet", choices=["vet", "admin"])
    p.add_argument("--full-name", default="", dest="full_name", help="Optional display name")
    p.add_argument(
        "--clinic-id",
        default="",
        dest="clinic_id",
        help="MongoDB clinic ObjectId for the vet (from the clinics collection via python scripts)",
    )
    args = p.parse_args()

    email = bleach.clean(args.email, strip=True).lower()
    if not email:
        print("Invalid email", file=sys.stderr)
        sys.exit(2)

    db = get_db()
    if db["users"].find_one({"email": email}):
        print(f"This email is already registered: {email}", file=sys.stderr)
        sys.exit(1)

    fn = (args.full_name or "").strip() or None
    doc: dict = {
        "email": email,
        "password_hash": hash_password(args.password),
        "role": args.role,
        "full_name": fn,
    }
    raw_cid = (args.clinic_id or "").strip()
    if raw_cid:
        if args.role != "vet":
            print("--clinic-id can only be used with --role vet.", file=sys.stderr)
            sys.exit(2)
        try:
            coid = ObjectId(raw_cid)
        except Exception:
            print("Invalid --clinic-id", file=sys.stderr)
            sys.exit(2)
        if not db["clinics"].find_one({"_id": coid}, {"_id": 1}):
            print("Clinic not found.", file=sys.stderr)
            sys.exit(2)
        doc["clinic_id"] = coid

    db["users"].insert_one(doc)
    print(f"Done: {email} ({args.role})")


if __name__ == "__main__":
    main()
