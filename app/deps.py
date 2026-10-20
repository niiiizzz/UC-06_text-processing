from typing import Optional
from fastapi import Request, Depends
from app.auth import Principal, decode_session_token
from app.errors import LatheError


async def get_optional_principal(request: Request) -> Optional[Principal]:
    token: Optional[str] = None

    # 1. Bearer header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    # 2. Session cookie
    if not token:
        token = request.cookies.get("lathe_session")

    if not token:
        return None

    return decode_session_token(token)


async def get_principal(
    principal: Optional[Principal] = Depends(get_optional_principal),
) -> Principal:
    if not principal:
        raise LatheError(
            code="UNAUTHENTICATED",
            message="Authentication required. Please provide a valid session or Bearer token.",
            status_code=401,
        )
    return principal
