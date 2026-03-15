from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AppointmentStatus = Literal["pending", "confirmed", "cancelled", "completed"]


class AppointmentCreate(BaseModel):
    pet_id: str = Field(..., description="Evcil hayvan ID")
    scheduled_at: datetime = Field(..., description="Randevu tarih ve saati")
    reason: str = Field("", max_length=500, description="Randevu nedeni (kontrol, aşı, vb.)")


class AppointmentUpdate(BaseModel):
    status: AppointmentStatus | None = None
    scheduled_at: datetime | None = None
    reason: str | None = None


class AppointmentPublic(BaseModel):
    id: str
    owner_id: str
    pet_id: str
    scheduled_at: datetime
    reason: str
    status: AppointmentStatus
    created_at: datetime | None = None
    # Gösterim için
    pet_name: str | None = None
