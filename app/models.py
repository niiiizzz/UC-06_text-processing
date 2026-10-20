from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    tenant_id: str
    role: str
    email: str


class UserMeResponse(BaseModel):
    user_id: str
    tenant_id: str
    role: str
    email: str
