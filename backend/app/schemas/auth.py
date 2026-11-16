from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    fullName: str = Field(min_length=1, max_length=120)
    email: EmailStr
    studentId: str | None = Field(default=None, max_length=80)
    password: str = Field(min_length=8, max_length=72)
    department: str | None = Field(default=None, max_length=120)
    academicLevel: str | None = Field(default=None, max_length=40)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=72)


class ProfileUpdateRequest(BaseModel):
    fullName: str = Field(min_length=1, max_length=120)
    studentId: str | None = Field(default=None, max_length=80)
    department: str | None = Field(default=None, max_length=120)
    academicLevel: str | None = Field(default=None, max_length=40)


class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=72)
    newPassword: str = Field(min_length=8, max_length=72)
