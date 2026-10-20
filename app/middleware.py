import json
import uuid
import re
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from app.errors import make_error_response

TENANT_KEY_PATTERN = re.compile(r"^tenant(?:_id|id)?$", re.IGNORECASE)


def check_dict_for_tenant_keys(obj: any) -> bool:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(k, str) and TENANT_KEY_PATTERN.match(k.strip()):
                return True
            if check_dict_for_tenant_keys(v):
                return True
    elif isinstance(obj, list):
        for item in obj:
            if check_dict_for_tenant_keys(item):
                return True
    return False


class RequestIdAndTenantOverrideMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Request ID handling
        req_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.state.request_id = req_id

        # 2. Check header overrides: any header starting with X-Tenant
        for header_name in request.headers.keys():
            if header_name.lower().startswith("x-tenant"):
                resp = make_error_response(
                    status_code=400,
                    code="TENANT_OVERRIDE_REJECTED",
                    message="Tenant override via header is forbidden. Identity is determined by session only.",
                )
                resp.headers["X-Request-Id"] = req_id
                return resp

        # 3. Check query param overrides: tenant, tenant_id, tenantId, etc.
        for qk in request.query_params.keys():
            if TENANT_KEY_PATTERN.match(qk.strip()):
                resp = make_error_response(
                    status_code=400,
                    code="TENANT_OVERRIDE_REJECTED",
                    message="Tenant override via query parameter is forbidden. Identity is determined by session only.",
                )
                resp.headers["X-Request-Id"] = req_id
                return resp

        # 4. Check body if JSON
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type.lower():
            body_bytes = await request.body()
            request.state.body_bytes = body_bytes

            if len(body_bytes) > 65536:
                resp = make_error_response(
                    status_code=400,
                    code="PAYLOAD_TOO_LARGE",
                    message="Request payload exceeds maximum allowed size of 64 KiB.",
                )
                resp.headers["X-Request-Id"] = req_id
                return resp

            if body_bytes:
                try:
                    body_json = json.loads(body_bytes.decode("utf-8"))
                    request.state.body_json = body_json
                    if check_dict_for_tenant_keys(body_json):
                        resp = make_error_response(
                            status_code=400,
                            code="TENANT_OVERRIDE_REJECTED",
                            message="Tenant override inside request payload is forbidden. Identity is determined by session only.",
                        )
                        resp.headers["X-Request-Id"] = req_id
                        return resp
                except json.JSONDecodeError:
                    pass

        response = await call_next(request)
        response.headers["X-Request-Id"] = req_id
        return response
