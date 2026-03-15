from __future__ import annotations

import pathlib

import pandas as pd
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/data", tags=["data"])

DATA_DIR = pathlib.Path(__file__).resolve().parents[1] / "data"


@router.get("/preview")
def preview_csv(filename: str = "sample.csv", rows: int = 5):
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    df = pd.read_csv(path)
    return {"columns": list(df.columns), "preview": df.head(rows).to_dict(orient="records")}
