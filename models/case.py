from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CaseBase(BaseModel):
    pet_id: str = Field(..., description="İlgili pet ID")
    adr_no: str | None = Field(default=None, description="Varsa Tigress ADRNo")
    symptoms: list[str] = Field(..., min_items=1, description="Girilen semptomlar")
    vet_notes: str | None = Field(default=None, max_length=4000)
    status: str = Field(
        default="open",
        description="Vaka durumu (open, in_review, closed vb.)",
    )


class CaseCreate(CaseBase):
    pass


class CaseUpdate(BaseModel):
    symptoms: list[str] | None = None
    vet_notes: str | None = None
    status: str | None = None


class CaseInDB(CaseBase):
    id: str
    created_at: datetime
    updated_at: datetime
    risk_level: int | None = None
    risk_label: str | None = None
    serious: bool | None = None


class CasePublic(CaseInDB):
    pass

