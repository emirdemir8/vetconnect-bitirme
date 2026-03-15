from __future__ import annotations

import pathlib
import sys

import pandas as pd
from pymongo import ReplaceOne

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.db.mongo import get_db


DATA_DIR = ROOT / "data"


def _read_excel(sheet_name: str) -> pd.DataFrame:
    """
    Read a sheet from TigressADR.xlsx by sheet name (e.g. 'Animal', 'Animal Symptoms', 'SAR').
    """
    path = DATA_DIR / "TigressADR.xlsx"
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

    df = pd.read_excel(path, sheet_name=sheet_name)
    df.columns = [str(c).strip() for c in df.columns]
    if "ADRNo" not in df.columns:
        raise ValueError(
            f"Sheet {sheet_name!r} in TigressADR.xlsx must contain ADRNo column. "
            f"Found: {list(df.columns)}"
        )
    df["ADRNo"] = df["ADRNo"].astype(str).str.strip()
    return df


def _collapse_many_to_one(df: pd.DataFrame) -> pd.DataFrame:
    non_key_cols = [c for c in df.columns if c != "ADRNo"]
    if not non_key_cols:
        return df.drop_duplicates(subset=["ADRNo"]).copy()

    def agg_series(s: pd.Series):
        vals = [v for v in s.dropna().tolist() if str(v).strip() != ""]
        if not vals:
            return None
        uniq = []
        seen: set[str] = set()
        for v in vals:
            key = str(v)
            if key in seen:
                continue
            seen.add(key)
            uniq.append(v)
        return uniq if len(uniq) > 1 else uniq[0]

    grouped = df.groupby("ADRNo", as_index=False)[non_key_cols].agg(agg_series)
    return grouped


def build_knowledge_dataframe() -> pd.DataFrame:
    """
    Merge Animal / Animal Symptoms / SAR Excel sheets on ADRNo into a single knowledge dataframe.
    """
    animal = _read_excel("Animal")
    symptoms = _collapse_many_to_one(_read_excel("Animal Symptoms"))
    sar = _collapse_many_to_one(_read_excel("SAR"))

    merged = animal.merge(symptoms, on="ADRNo", how="outer", suffixes=("", "_sym"))
    merged = merged.merge(sar, on="ADRNo", how="outer", suffixes=("", "_sar"))
    return merged


def upsert_knowledge(df: pd.DataFrame) -> int:
    db = get_db()
    col = db["vet_knowledge_base"]

    records = df.where(pd.notnull(df), None).to_dict(orient="records")
    ops = []
    for r in records:
        adrno = str(r.get("ADRNo") or "").strip()
        if not adrno:
            continue
        doc = dict(r)
        doc["_id"] = adrno
        ops.append(ReplaceOne({"_id": adrno}, doc, upsert=True))

    if not ops:
        return 0

    result = col.bulk_write(ops, ordered=False)
    return int(result.upserted_count + result.modified_count)


def main() -> None:
    df = build_knowledge_dataframe()
    n = upsert_knowledge(df)
    print(
        f"Seeded vet_knowledge_base in MongoDB '{settings.mongo_db}'. "
        f"Rows in merged dataframe: {len(df)}. Upserted/modified: {n}."
    )


if __name__ == "__main__":
    main()

