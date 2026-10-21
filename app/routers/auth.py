from fastapi import APIRouter, Response, Depends, status
from app.models import LoginRequest, LoginResponse, UserMeResponse
from app.auth import verify_password, hash_password, create_session_token, Principal
from app.deps import get_principal
from app.errors import LatheError
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

# Dummy hash for constant-time comparison on unknown user
_DUMMY_HASH = hash_password("dummy_password_for_timing_safety")


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest, response: Response):
    try:
        from app.adapters.sql import get_sql_client
        sql = get_sql_client()

        user = await sql.get_user_by_email(credentials.email.strip().lower())
        if not user:
            # Constant-time comparison simulation to prevent enumeration
            verify_password(_DUMMY_HASH, credentials.password)
            raise LatheError(
                code="UNAUTHENTICATED",
                message="Email or password is incorrect.",
                status_code=401,
            )

        if not verify_password(user["password_hash"], credentials.password):
            raise LatheError(
                code="UNAUTHENTICATED",
                message="Email or password is incorrect.",
                status_code=401,
            )

        if not user.get("is_active", True):
            raise LatheError(
                code="UNAUTHENTICATED",
                message="User account is deactivated.",
                status_code=401,
            )

        token = create_session_token(
            user_id=user["user_id"],
            tenant_id=user["tenant_id"],
            role=user["role"],
            email=user["email"],
        )

        # Set HttpOnly, Secure, SameSite=Lax cookie
        response.set_cookie(
            key="lathe_session",
            value=token,
            max_age=settings.SESSION_TTL_MINUTES * 60,
            httponly=True,
            secure=(settings.APP_ENV != "dev"),
            samesite="lax",
            path="/",
        )

        return LoginResponse(
            token=token,
            user_id=user["user_id"],
            tenant_id=user["tenant_id"],
            role=user["role"],
            email=user["email"],
        )
    except LatheError:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise LatheError(
            code="INTERNAL_ERROR",
            message=f"Authentication error: {str(e)}",
            status_code=500,
        )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    response.delete_cookie(key="lathe_session", path="/")
    return {"status": "ok"}


@router.get("/me", response_model=UserMeResponse)
async def me(principal: Principal = Depends(get_principal)):
    return UserMeResponse(
        user_id=principal.user_id,
        tenant_id=principal.tenant_id,
        role=principal.role,
        email=principal.email,
    )
