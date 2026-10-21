from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": settings.VERSION,
    }


@router.get("/health/db-check")
async def db_check():
    from app.adapters.sql import get_sql_client
    try:
        sql = get_sql_client()
        user = await sql.get_user_by_email("view.a@lathe.test")
        return {
            "status": "ok",
            "auth_mode": sql.auth_mode,
            "user_found": bool(user),
            "user_email": user.get("email") if user else None,
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
