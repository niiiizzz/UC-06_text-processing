import uuid
import re
import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Request, Response, Header, Depends, status
from pydantic import BaseModel, Field
from app.auth import Principal
from app.deps import get_principal
from app.config import settings
from app.errors import LatheError, make_error_response
from app.adapters.sql import get_sql_client
from app.adapters.blob import get_blob_client
from app.services.validation import validate_records
from app.services.processor import process_records
from app.services.fingerprint import compute_fingerprint
from app.services.entitlements import authorize_submit, PLAN_LIMITS

router = APIRouter(prefix="/runs", tags=["runs"])

IDEMPOTENCY_KEY_REGEX = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_run(
    request: Request,
    response: Response,
    principal: Principal = Depends(get_principal),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """
    POST /runs implementation following docs/05_API.md Section 5.1 check order:
    1. Authenticate (handled by get_principal dependency) -> 401
    2. Tenant-override guard (handled by RequestIdAndTenantOverrideMiddleware) -> 400
    3. Role is Operator -> 403 FORBIDDEN_ROLE
    4. Subscription Active -> 403 SUBSCRIPTION_SUSPENDED
    5. Plan permits requested operation -> 403 FORBIDDEN_PLAN (needs operation parsed; if invalid -> 400)
    6. Idempotency-Key present and valid -> 400
    7. Body size <= 64 KiB, JSON object, exact keys, records is list of 1-10 objects with exact 4 keys -> 400
    8. process only: any invalid row -> 400 with issues in details
    9. Transaction: insert run -> (duplicate? replay path) -> reserve quota -> (none? 429)
    10. Execute -> persist -> respond (201 new run, 200 replayed)
    """
    sql = get_sql_client()
    blob = get_blob_client()

    # Step 6: Idempotency-Key header check
    if not idempotency_key or not idempotency_key.strip() or len(idempotency_key.strip()) > 128:
        raise LatheError(
            code="MISSING_IDEMPOTENCY_KEY",
            message="Idempotency-Key header is required and must be 1 to 128 characters.",
            status_code=400,
        )
    key = idempotency_key.strip()
    if not IDEMPOTENCY_KEY_REGEX.match(key):
        raise LatheError(
            code="MISSING_IDEMPOTENCY_KEY",
            message="Idempotency-Key must contain only printable ASCII characters [A-Za-z0-9._:-].",
            status_code=400,
        )

    # Step 7: Parse body and check exact shape
    if hasattr(request.state, "body_json") and request.state.body_json is not None:
        body = request.state.body_json
    else:
        try:
            body_bytes = getattr(request.state, "body_bytes", None)
            if body_bytes is None:
                body_bytes = await request.body()
            import json
            body = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            raise LatheError(
                code="VALIDATION_ERROR",
                message="Malformed JSON body.",
                status_code=400,
            )

    if not isinstance(body, dict):
        raise LatheError(
            code="VALIDATION_ERROR",
            message="Request body must be a JSON object.",
            status_code=400,
        )

    # Exactly two top-level keys: operation, records
    if set(body.keys()) != {"operation", "records"}:
        raise LatheError(
            code="VALIDATION_ERROR",
            message="Body must contain exactly two keys: 'operation' and 'records'.",
            status_code=400,
        )

    operation = body.get("operation")
    if operation not in ("validate", "process"):
        raise LatheError(
            code="VALIDATION_ERROR",
            message="Operation must be 'validate' or 'process'.",
            status_code=400,
        )

    records = body.get("records")
    if not isinstance(records, list) or not (1 <= len(records) <= 10):
        raise LatheError(
            code="VALIDATION_ERROR",
            message="Records must be a list of 1 to 10 row objects.",
            status_code=400,
        )

    # Each record must have exactly four keys
    required_record_keys = {"record_id", "text", "repeat", "mode"}
    for idx, rec in enumerate(records, start=1):
        if not isinstance(rec, dict) or set(rec.keys()) != required_record_keys:
            raise LatheError(
                code="VALIDATION_ERROR",
                message=f"Row {idx} must contain exactly four keys: record_id, text, repeat, mode.",
                status_code=400,
            )

    # Step 3, 4, 5: Entitlements (role, subscription status, plan)
    tenant = await sql.get_tenant(principal.tenant_id)
    if not tenant:
        raise LatheError(code="NOT_FOUND", message="Tenant not found.", status_code=404)

    authorize_submit(principal, tenant, operation)

    # Step 8: Validate records; if process and any invalid row -> 400 with issues
    val_result = validate_records(records)
    if operation == "process" and val_result["invalid_rows"] > 0:
        raise LatheError(
            code="VALIDATION_ERROR",
            message="Batch contains invalid rows and cannot be processed.",
            status_code=400,
            details={"issues": val_result["issues"]},
        )

    # Step 9: Atomic transaction & Idempotency authority
    fingerprint = compute_fingerprint(operation, records)
    run_id = str(uuid.uuid4())
    daily_limit = PLAN_LIMITS.get(tenant.get("plan", "Basic"), 3)

    accept_status = await sql.accept_run(
        run_id=run_id,
        tenant_id=principal.tenant_id,
        idempotency_key=key,
        input_fingerprint=fingerprint,
        operation=operation,
        user_id=principal.user_id,
        row_count=len(records),
        limit=daily_limit,
    )

    if accept_status == "DUPLICATE_KEY":
        # Replay path
        existing = await sql.get_run_by_key(principal.tenant_id, key)
        if not existing:
            # Race edge-case
            raise LatheError(code="IDEMPOTENCY_CONFLICT", message="Idempotency conflict.", status_code=409)

        if existing["input_fingerprint"] != fingerprint or existing["operation"] != operation:
            raise LatheError(
                code="IDEMPOTENCY_CONFLICT",
                message="Idempotency key has already been used with different input or operation.",
                status_code=409,
            )

        if existing["status"] == "Running":
            raise LatheError(
                code="RUN_IN_PROGRESS",
                message="A run with this idempotency key is currently running.",
                status_code=409,
            )

        # Terminal run replay: return 200 with original run metadata
        response.status_code = status.HTTP_200_OK
        return {
            "run_id": str(existing["run_id"]),
            "status": existing["status"],
            "operation": existing["operation"],
            "replayed": True,
            "created_at": existing["created_at"],
        }

    if accept_status == "QUOTA_EXHAUSTED":
        # Compute seconds until midnight UTC for Retry-After
        now = datetime.datetime.now(datetime.timezone.utc)
        tomorrow = (now + datetime.timedelta(days=1)).date()
        midnight = datetime.datetime.combine(tomorrow, datetime.time.min, tzinfo=datetime.timezone.utc)
        retry_after_sec = int((midnight - now).total_seconds())

        raise LatheError(
            code="QUOTA_EXHAUSTED",
            message="Daily quota used up.",
            status_code=429,
            headers={"Retry-After": str(retry_after_sec)},
        )

    # Step 10: Run accepted! Now execute & persist terminal result
    created_at_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    force_failure = False
    if settings.ENABLE_TEST_HOOKS and request.headers.get("X-Test-Force-Failure", "").lower() == "true":
        force_failure = True

    if force_failure:
        # A11 test hook: fail after acceptance
        await sql.finish_run(
            run_id=run_id,
            tenant_id=principal.tenant_id,
            status="Failed",
            error_code="FORCED_FAILURE",
            error_message="Run failed after acceptance.",
        )
        return {
            "run_id": run_id,
            "status": "Failed",
            "operation": operation,
            "replayed": False,
            "created_at": created_at_str,
        }

    try:
        if operation == "validate":
            result_payload = {
                "operation": "validate",
                "valid_rows": val_result["valid_rows"],
                "invalid_rows": val_result["invalid_rows"],
                "issues": val_result["issues"],
            }
        else:
            proc_out = process_records(records)
            result_payload = {
                "operation": "process",
                "summary": proc_out["summary"],
                "rows": proc_out["rows"],
                "issues": [],
            }

        blob_path = await blob.save_result(principal.tenant_id, run_id, result_payload)
        await sql.finish_run(
            run_id=run_id,
            tenant_id=principal.tenant_id,
            status="Succeeded",
            valid_rows=val_result["valid_rows"],
            invalid_rows=val_result["invalid_rows"],
            result_blob_path=blob_path,
        )

        return {
            "run_id": run_id,
            "status": "Succeeded",
            "operation": operation,
            "replayed": False,
            "created_at": created_at_str,
        }
    except Exception as exc:
        await sql.finish_run(
            run_id=run_id,
            tenant_id=principal.tenant_id,
            status="Failed",
            error_code="PROCESSING_ERROR",
            error_message=str(exc),
        )
        return {
            "run_id": run_id,
            "status": "Failed",
            "operation": operation,
            "replayed": False,
            "created_at": created_at_str,
        }


@router.get("")
async def list_runs(principal: Principal = Depends(get_principal)):
    sql = get_sql_client()
    runs = await sql.list_runs(principal.tenant_id, limit=50)
    formatted = []
    for r in runs:
        formatted.append({
            "run_id": str(r["run_id"]),
            "operation": r["operation"],
            "status": r["status"],
            "row_count": r["row_count"],
            "valid_rows": r.get("valid_rows"),
            "invalid_rows": r.get("invalid_rows"),
            "created_at": r["created_at"],
            "finished_at": r.get("finished_at"),
        })
    return {"runs": formatted}


@router.get("/{run_id}/result")
async def get_run_result(run_id: str, principal: Principal = Depends(get_principal)):
    # Validate UUID shape; if invalid -> 404 per spec
    try:
        uuid.UUID(run_id)
    except Exception:
        raise LatheError(code="NOT_FOUND", message="Run not found.", status_code=404)

    sql = get_sql_client()
    blob = get_blob_client()

    run = await sql.get_run_by_id(principal.tenant_id, run_id)
    if not run:
        raise LatheError(code="NOT_FOUND", message="Run not found.", status_code=404)

    status_str = run["status"]
    if status_str == "Running":
        return {
            "run_id": str(run["run_id"]),
            "status": "Running",
        }

    if status_str == "Failed":
        return {
            "run_id": str(run["run_id"]),
            "status": "Failed",
            "error": {
                "code": run.get("error_code") or "RUN_FAILED",
                "message": run.get("error_message") or "Run failed.",
            },
        }

    # Succeeded run: fetch result from blob
    blob_path = run.get("result_blob_path")
    result_data = None
    if blob_path:
        result_data = await blob.get_result(blob_path)

    return {
        "run_id": str(run["run_id"]),
        "status": "Succeeded",
        "result": result_data,
    }
