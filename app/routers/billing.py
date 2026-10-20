import hmac
import hashlib
import datetime
import uuid
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, status

from app.config import settings
from app.auth import Principal
from app.deps import get_principal
from app.errors import LatheError
from app.adapters.sql import get_sql_client

router = APIRouter(prefix="/billing", tags=["billing"])

PRO_PLAN_AMOUNT_MIN_PAISE = 49900  # Rs 499.00
CURRENCY = "INR"


class CreatePledgeRequest(BaseModel):
    target_plan: str


class SettlePledgeRequest(BaseModel):
    voucher: str


def compute_receipt_signature(
    pledge_id: str, tenant_id: str, plan: str, amount_minor: int, settled_at: str
) -> str:
    message = f"{pledge_id}|{tenant_id}|{plan}|{amount_minor}|{settled_at}"
    sig = hmac.new(
        settings.SESSION_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return sig


def verify_billing_enabled():
    if not settings.FEATURE_BILLING_SIM:
        raise LatheError(
            code="NOT_FOUND",
            message="Billing simulation is disabled.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


@router.get("/plans")
async def get_plans(principal: Principal = Depends(get_principal)):
    verify_billing_enabled()
    return {
        "plans": [
            {
                "id": "Basic",
                "name": "Basic",
                "price_display": "₹0",
                "amount_minor": 0,
                "currency": "INR",
                "daily_limit": 3,
                "features": ["Validate operation", "3 daily runs", "7-day history retention"],
            },
            {
                "id": "Pro",
                "name": "Pro",
                "price_display": "₹499/month",
                "amount_minor": PRO_PLAN_AMOUNT_MIN_PAISE,
                "currency": "INR",
                "daily_limit": 10,
                "features": [
                    "Validate & Process operations",
                    "10 daily runs",
                    "30-day result storage",
                    "Idempotency guarantees",
                ],
            },
        ]
    }


@router.post("/pledges", status_code=status.HTTP_201_CREATED)
async def create_pledge(payload: CreatePledgeRequest, principal: Principal = Depends(get_principal)):
    verify_billing_enabled()
    if principal.role != "Operator":
        raise LatheError(
            code="FORBIDDEN_ROLE",
            message="Only Operators can manage billing pledges.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if payload.target_plan != "Pro":
        raise LatheError(
            code="VALIDATION_ERROR",
            message="Only upgrade to Pro plan is supported.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    sql = get_sql_client()
    snapshot = await sql.get_subscription_snapshot(principal.tenant_id)
    if snapshot and snapshot.get("plan") == "Pro":
        raise LatheError(
            code="IDEMPOTENCY_CONFLICT",
            message="Workspace is already on the Pro plan.",
            status_code=status.HTTP_409_CONFLICT,
        )

    pledge_id = f"plg_{uuid.uuid4().hex[:16]}"
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = (now + datetime.timedelta(minutes=15)).isoformat()
    created_at = now.isoformat()

    pledge_doc = {
        "pledge_id": pledge_id,
        "tenant_id": principal.tenant_id,
        "created_by": principal.user_id,
        "target_plan": "Pro",
        "amount_minor": PRO_PLAN_AMOUNT_MIN_PAISE,
        "currency": CURRENCY,
        "status": "open",
        "receipt_no": None,
        "receipt_sig": None,
        "created_at": created_at,
        "settled_at": None,
        "expires_at": expires_at,
    }

    await sql.create_pledge(pledge_doc)

    return {
        "pledge_id": pledge_id,
        "target_plan": "Pro",
        "amount_minor": PRO_PLAN_AMOUNT_MIN_PAISE,
        "currency": CURRENCY,
        "status": "open",
        "expires_at": expires_at,
    }


@router.post("/pledges/{pledge_id}/settle")
async def settle_pledge(
    pledge_id: str, payload: SettlePledgeRequest, principal: Principal = Depends(get_principal)
):
    verify_billing_enabled()
    if principal.role != "Operator":
        raise LatheError(
            code="FORBIDDEN_ROLE",
            message="Only Operators can settle billing pledges.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    sql = get_sql_client()
    pledge = await sql.get_pledge(principal.tenant_id, pledge_id)
    if not pledge:
        raise LatheError(
            code="NOT_FOUND",
            message="Pledge not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Idempotent settle: if already settled, return existing receipt
    if pledge["status"] == "settled":
        return {
            "pledge_id": pledge["pledge_id"],
            "status": "settled",
            "receipt": {
                "receipt_no": pledge["receipt_no"],
                "pledge_id": pledge["pledge_id"],
                "plan": pledge["target_plan"],
                "amount_minor": pledge["amount_minor"],
                "currency": pledge["currency"],
                "settled_at": pledge["settled_at"],
                "signature": pledge["receipt_sig"],
            },
        }

    voucher = payload.voucher.strip().upper()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if voucher == "BENCH-CLEAR":
        receipt_no = f"LR-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        signature = compute_receipt_signature(
            pledge_id=pledge["pledge_id"],
            tenant_id=principal.tenant_id,
            plan=pledge["target_plan"],
            amount_minor=pledge["amount_minor"],
            settled_at=now_iso,
        )

        await sql.update_pledge_and_plan(
            tenant_id=principal.tenant_id,
            pledge_id=pledge_id,
            status="settled",
            receipt_no=receipt_no,
            receipt_sig=signature,
            settled_at=now_iso,
            upgrade_plan="Pro",
        )

        return {
            "pledge_id": pledge_id,
            "status": "settled",
            "receipt": {
                "receipt_no": receipt_no,
                "pledge_id": pledge_id,
                "plan": "Pro",
                "amount_minor": pledge["amount_minor"],
                "currency": pledge["currency"],
                "settled_at": now_iso,
                "signature": signature,
            },
        }

    elif voucher == "BENCH-DECLINE":
        await sql.update_pledge_and_plan(
            tenant_id=principal.tenant_id,
            pledge_id=pledge_id,
            status="declined",
            receipt_no=None,
            receipt_sig=None,
            settled_at=None,
        )
        return {
            "pledge_id": pledge_id,
            "status": "declined",
            "reason": "INSUFFICIENT_BENCH_FUNDS",
        }

    elif voucher == "BENCH-HOLD":
        # Simulates a pending transaction
        await sql.update_pledge_and_plan(
            tenant_id=principal.tenant_id,
            pledge_id=pledge_id,
            status="held",
            receipt_no=None,
            receipt_sig=None,
            settled_at=None,
        )
        return {
            "pledge_id": pledge_id,
            "status": "held",
            "message": "Holding... verifying with settlement network",
        }

    elif voucher == "BENCH-EXPIRE":
        await sql.update_pledge_and_plan(
            tenant_id=principal.tenant_id,
            pledge_id=pledge_id,
            status="expired",
            receipt_no=None,
            receipt_sig=None,
            settled_at=None,
        )
        return {
            "pledge_id": pledge_id,
            "status": "expired",
            "reason": "Pledge validity period lapsed.",
        }

    else:
        raise LatheError(
            code="VALIDATION_ERROR",
            message=f"Unknown test voucher: '{voucher}'. Use BENCH-CLEAR, BENCH-DECLINE, BENCH-HOLD, or BENCH-EXPIRE.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


@router.get("/receipts")
async def get_receipts(principal: Principal = Depends(get_principal)):
    verify_billing_enabled()
    sql = get_sql_client()
    rows = await sql.get_tenant_receipts(principal.tenant_id)
    receipts = []
    for r in rows:
        receipts.append(
            {
                "receipt_no": r["receipt_no"],
                "pledge_id": r["pledge_id"],
                "plan": r["target_plan"],
                "amount_minor": r["amount_minor"],
                "currency": r["currency"],
                "settled_at": r["settled_at"],
                "signature": r["receipt_sig"],
            }
        )
    return {"receipts": receipts}
