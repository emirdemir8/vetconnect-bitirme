from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class VaccineEntry(BaseModel):
    vaccine_type: str = Field(..., description="Aşı türü (id veya ad)")
    status: Literal["done", "planned"] = Field(
        default="done",
        description="done=yapıldı, planned=yapılacak",
    )
    vaccinated_at: date | None = Field(default=None, description="Aşı tarihi (yapıldı ise dolu, yapılacak ise planlanan tarih)")

    @model_validator(mode="after")
    def done_requires_date(self):
        if self.status == "done" and self.vaccinated_at is None:
            raise ValueError("Yapıldı seçiliyse aşı tarihi zorunludur.")
        return self


class PetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    species: str = Field(..., min_length=1, max_length=50, description="Tür (örn. dog, cat)")
    breed: str | None = Field(default=None, max_length=100)
    sex: str | None = Field(default=None, description="M, F vb.")
    date_of_birth: date | None = None
    weight_kg: float | None = Field(default=None, ge=0, le=500, description="Ağırlık (kg)")
    microchip: str | None = Field(default=None, max_length=50, description="Mikroçip numarası")
    vaccine_history: list[VaccineEntry] = Field(
        default_factory=list,
        description="Aşı geçmişi: hangi aşı, hangi tarih",
    )
    notes: str | None = Field(default=None, max_length=2000)
    card_color: str | None = Field(default=None, max_length=20, description="Kart rengi (hex veya isim)")
    avatar_emoji: str | None = Field(default=None, max_length=10, description="Profil emojisi (örn. 🐕 🐈)")
    image_url: str | None = Field(default=None, max_length=2000, description="Optional photo URL (http/https only)")


class PetCreate(PetBase):
    owner_id: str | None = Field(
        default=None,
        description="Evcil hayvan sahibi kullanıcı ID'si; pet owner panelinde otomatik doldurulur.",
    )


class PetUpdate(BaseModel):
    name: str | None = None
    species: str | None = None
    breed: str | None = None
    sex: str | None = None
    date_of_birth: date | None = None
    weight_kg: float | None = None
    microchip: str | None = None
    vaccine_history: list[VaccineEntry] | None = None
    notes: str | None = None
    card_color: str | None = None
    avatar_emoji: str | None = None
    image_url: str | None = None


class PetInDB(PetBase):
    id: str
    owner_id: str | None = None

    class Config:
        json_encoders = {date: lambda v: v.isoformat()}


class PetPublic(PetInDB):
    """API'de dönen pet; vet listesinde sahip bilgisi doldurulur."""
    owner_email: str | None = None
    owner_name: str | None = None

