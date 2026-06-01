from __future__ import annotations

import pathlib

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from app.utils.security import get_current_user

router = APIRouter(prefix="/data", tags=["data"])

DATA_DIR = pathlib.Path(__file__).resolve().parents[1] / "data"


@router.get("/preview")
def preview_csv(
    filename: str = "sample.csv",
    rows: int = 5,
    current=Depends(get_current_user),
):
    safe_name = pathlib.Path(filename).name
    if not safe_name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files can be previewed.")
    rows = max(1, min(int(rows), 100))
    path = DATA_DIR / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {safe_name}")
    try:
        df = pd.read_csv(path, nrows=rows)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read CSV file.")
    return {"columns": list(df.columns), "preview": df.head(rows).to_dict(orient="records")}
