from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class VaccineEntry(BaseModel):
    vaccine_type: str = Field(..., description="Vaccine type (id or name)")
    status: Literal["done", "planned"] = Field(
        default="done",
        description="done=completed, planned=scheduled",
    )
    vaccinated_at: date | None = Field(default=None, description="Vaccination date (filled in if completed, planned date if scheduled)")

    @model_validator(mode="after")
    def done_requires_date(self):
        if self.status == "done" and self.vaccinated_at is None:
            raise ValueError("Vaccination date is required when status is done.")
        return self


class PetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    species: str = Field(..., min_length=1, max_length=50, description="Species (e.g. dog, cat)")
    breed: str | None = Field(default=None, max_length=100)
    sex: str | None = Field(default=None, description="M, F, etc.")
    date_of_birth: date | None = None
    weight_kg: float | None = Field(default=None, ge=0, le=500, description="Weight (kg)")
    microchip: str | None = Field(default=None, max_length=50, description="Microchip number")
    vaccine_history: list[VaccineEntry] = Field(
        default_factory=list,
        description="Vaccination history: which vaccine, which date",
    )
    notes: str | None = Field(default=None, max_length=2000)
    card_color: str | None = Field(default=None, max_length=20, description="Card color (hex or name)")
    avatar_emoji: str | None = Field(default=None, max_length=10, description="Profile emoji (e.g. 🐕 🐈)")
    image_url: str | None = Field(default=None, max_length=2000, description="Optional photo URL (http/https only)")


class PetCreate(PetBase):
    owner_id: str | None = Field(
        default=None,
        description="Pet owner user ID; auto-filled in the pet owner panel.",
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
    """Pet returned by the API; owner information is filled in within the vet list."""
    owner_email: str | None = None
    owner_name: str | None = None

