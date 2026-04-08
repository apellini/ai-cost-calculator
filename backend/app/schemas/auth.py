from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool = True
    last_active_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "analyst"


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class PasswordChangeAdmin(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class PasswordChangeSelf(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class InviteCreate(BaseModel):
    email: EmailStr
    name: str
    role: str = "analyst"
    password: str | None = None  # auto-generated if None


class InviteResponse(BaseModel):
    user: UserOut
    invite_url: str
    generated_password: str | None = None  # present only when auto-generated
