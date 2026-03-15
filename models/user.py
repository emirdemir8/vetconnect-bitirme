from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(vet|pet_owner|admin)$", description="Kullanıcı rolü")


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserInDB(UserBase):
    id: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    role: str
