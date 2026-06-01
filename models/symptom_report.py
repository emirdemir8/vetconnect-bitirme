from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SymptomReportCreate(BaseModel):
    pet_id: str = Field(..., description="Pet ID")
    animal_species: str | None = None
    product_or_vaccine: str | None = None
    symptoms: list[str] = Field(default_factory=list)
    free_text: str | None = None
    adr_no: str | None = None
    # System response (check-serious result)
    system_serious: bool = False
    system_risk_level: int | None = None
    system_risk_label: str | None = None
    system_reasons: list[str] = Field(default_factory=list)
    system_inferred_symptoms: list[str] = Field(default_factory=list)
    system_matched_symptoms: list[str] = Field(default_factory=list)
    system_matched_records: int = 0
    owner_guidance: str | None = None
    owner_guidance_source: str | None = Field(
        default=None,
        description="openai | template",
    )


class SymptomReportVetFeedback(BaseModel):
    vet_feedback: str = Field(..., min_length=1, max_length=2000)


class SymptomReportPublic(BaseModel):
    id: str
    owner_id: str
    pet_id: str
    animal_species: str | None
    product_or_vaccine: str | None
    symptoms: list[str]
    free_text: str | None
    adr_no: str | None
    system_serious: bool
    system_risk_level: int | None
    system_risk_label: str | None
    system_reasons: list[str]
    system_inferred_symptoms: list[str]
    system_matched_symptoms: list[str]
    system_matched_records: int
    owner_guidance: str | None = None
    owner_guidance_source: str | None = None
    created_at: datetime | None
    vet_feedback: str | None
    vet_feedback_at: datetime | None
    # For display (in the vet list; the email is not sent to the vet)
    pet_name: str | None = None
    owner_name: str | None = None
    owner_email: str | None = None
