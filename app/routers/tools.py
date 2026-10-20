from fastapi import APIRouter, Depends
from app.auth import Principal
from app.deps import get_principal
from app.adapters.sql import get_sql_client

router = APIRouter(tags=["tools"])


@router.get("/tools")
async def get_tools(principal: Principal = Depends(get_principal)):
    sql = get_sql_client()
    tenant = await sql.get_tenant(principal.tenant_id)
    plan = tenant.get("plan", "Basic") if tenant else "Basic"

    is_pro = (plan == "Pro")

    tools = [
        {
            "operation": "validate",
            "available": True,
            "description": "Check a batch against rules R1–R4.",
        },
        {
            "operation": "process",
            "available": is_pro,
            "reason": None if is_pro else "Pro plan required",
            "description": "Transform text: trim, apply case, repeat.",
        },
    ]

    return {
        "tools": tools,
        "limits": {
            "min_rows": 1,
            "max_rows": 10,
            "max_body_bytes": 65536,
        },
    }
