import time
from dataclasses import dataclass
from typing import Literal, Optional
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.config import settings
from app.errors import LatheError

ph = PasswordHasher()

@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    role: Literal["Operator", "Viewer"]
    email: str


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(hash_val: str, password: str) -> bool:
    try:
        return ph.verify(hash_val, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_session_token(user_id: str, tenant_id: str, role: str, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "tid": tenant_id,
        "role": role,
        "email": email,
        "iat": now,
        "exp": now + (settings.SESSION_TTL_MINUTES * 60),
    }
    return jwt.encode(payload, settings.SESSION_SECRET, algorithm="HS256")


def decode_session_token(token: str) -> Optional[Principal]:
    try:
        payload = jwt.decode(
            token,
            settings.SESSION_SECRET,
            algorithms=["HS256"],
            options={"require": ["sub", "tid", "role", "exp", "iat"]},
        )
        return Principal(
            user_id=payload["sub"],
            tenant_id=payload["tid"],
            role=payload["role"],
            email=payload.get("email", ""),
        )
    except jwt.PyJWTError:
        return None
