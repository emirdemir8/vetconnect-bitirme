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


def _read_csv(name: str) -> pd.DataFrame:
    path = DATA_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

    # CSVs exported from Excel/web tools may use different encodings and delimiters
    # (often ';' in TR locales). Use python engine with separator sniffing.
    last_err: Exception | None = None
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin1"):
        try:
            df = pd.read_csv(path, encoding=enc, sep=None, engine="python")
            break
        except UnicodeDecodeError as e:
            last_err = e
    else:
        raise last_err  # type: ignore[misc]
    df.columns = [str(c).strip() for c in df.columns]
    if "ADRNo" not in df.columns:
        raise ValueError(f"{name} must contain ADRNo column. Found: {list(df.columns)}")
    df["ADRNo"] = df["ADRNo"].astype(str).str.strip()
    return df


def _collapse_many_to_one(df: pd.DataFrame) -> pd.DataFrame:
    """
    If a source file has multiple rows per ADRNo (e.g. symptoms),
    collapse it into a single row per ADRNo by collecting per-column values.
    """
    non_key_cols = [c for c in df.columns if c != "ADRNo"]
    if not non_key_cols:
        return df.drop_duplicates(subset=["ADRNo"]).copy()

    def agg_series(s: pd.Series):
        vals = [v for v in s.dropna().tolist() if str(v).strip() != ""]
        if not vals:
            return None
        uniq = []
        seen = set()
        for v in vals:
            key = str(v)
            if key in seen:
                continue
            seen.add(key)
            uniq.append(v)
        return uniq if len(uniq) > 1 else uniq[0]

    grouped = df.groupby("ADRNo", as_index=False)[non_key_cols].agg(agg_series)
    return grouped


def build_reference_dataframe() -> pd.DataFrame:
    tigress = _read_csv("TigressADR - Animal.csv")
    symptoms = _collapse_many_to_one(_read_csv("Animal Symptoms.csv"))
    sar = _collapse_many_to_one(_read_csv("SAR.csv"))

    merged = tigress.merge(symptoms, on="ADRNo", how="outer", suffixes=("", "_sym"))
    merged = merged.merge(sar, on="ADRNo", how="outer", suffixes=("", "_sar"))
    return merged


def upsert_to_mongo(df: pd.DataFrame) -> int:
    db = get_db()
    col = db["reference_data"]

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
    df = build_reference_dataframe()
    n = upsert_to_mongo(df)
    print(
        f"Loaded reference_data into MongoDB '{settings.mongo_db}'. "
        f"Rows in merged dataframe: {len(df)}. Upserted/modified: {n}."
    )


if __name__ == "__main__":
    main()
