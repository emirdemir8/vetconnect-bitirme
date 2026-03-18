from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.mongo import get_db


def main() -> None:
    db = get_db()
    col = db["reference_data"]

    print("collection=reference_data")
    print("count_documents=", col.count_documents({}))

    adr = "0001/19"
    doc = col.find_one({"_id": adr})
    print("query _id=", adr)
    print(json.dumps(doc, default=str, ensure_ascii=False, indent=2)[:1200])


if __name__ == "__main__":
    main()

