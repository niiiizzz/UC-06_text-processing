from typing import Dict, Any
from app.auth import Principal
from app.errors import LatheError

PLAN_LIMITS = {
    "Basic": 3,
    "Pro": 10,
}


def authorize_submit(principal: Principal, tenant: Dict[str, Any], operation: str):
    """
    Entitlement check per docs/08_AUTH_SECURITY.md Section 3.3
    1. Role must be Operator (Viewer -> 403 FORBIDDEN_ROLE)
    2. Subscription must be Active (Suspended -> 403 SUBSCRIPTION_SUSPENDED)
    3. Plan: Basic can only validate, Pro can validate + process (Basic + process -> 403 FORBIDDEN_PLAN)
    """
    if principal.role != "Operator":
        raise LatheError(
            code="FORBIDDEN_ROLE",
            message="Only Operators can submit runs. Viewers have read-only access.",
            status_code=403,
        )

    if tenant.get("subscription_status") != "Active":
        raise LatheError(
            code="SUBSCRIPTION_SUSPENDED",
            message="This subscription is suspended. Past results are still readable.",
            status_code=403,
        )

    plan = tenant.get("plan", "Basic")
    if operation == "process" and plan != "Pro":
        raise LatheError(
            code="FORBIDDEN_PLAN",
            message="The 'process' tool requires a Pro plan. Upgrade to unlock.",
            status_code=403,
        )
