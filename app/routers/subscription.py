import datetime
from fastapi import APIRouter, Depends
from app.auth import Principal
from app.deps import get_principal
from app.adapters.sql import get_sql_client
from app.services.entitlements import PLAN_LIMITS

router = APIRouter(tags=["subscription"])


@router.get("/subscription")
async def get_subscription(principal: Principal = Depends(get_principal)):
    sql = get_sql_client()
    snapshot = await sql.get_subscription_snapshot(principal.tenant_id)
    if not snapshot:
        tenant_obj = {"id": principal.tenant_id, "name": "Unknown"}
        plan = "Basic"
        status = "Active"
        used_today = 0
    else:
        tenant_obj = {
            "id": snapshot["tenant_id"],
            "name": snapshot["display_name"],
        }
        plan = snapshot["plan"]
        status = snapshot["subscription_status"]
        used_today = snapshot["used_today"]

    daily_limit = PLAN_LIMITS.get(plan, 3)
    remaining = max(0, daily_limit - used_today)

    # Next UTC midnight reset
    now = datetime.datetime.now(datetime.timezone.utc)
    tomorrow = (now + datetime.timedelta(days=1)).date()
    resets_at = datetime.datetime.combine(tomorrow, datetime.time.min, tzinfo=datetime.timezone.utc).isoformat()

    return {
        "tenant": tenant_obj,
        "plan": plan,
        "status": status,
        "daily_limit": daily_limit,
        "used_today": used_today,
        "remaining": remaining,
        "resets_at": resets_at,
        "role": principal.role,
    }
