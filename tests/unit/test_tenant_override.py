import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_tenant_override_via_header_rejected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health", headers={"X-Tenant-Id": "tnt_a"})
        assert res.status_code == 400
        data = res.json()
        assert data["error"]["code"] == "TENANT_OVERRIDE_REJECTED"


@pytest.mark.asyncio
async def test_tenant_override_via_query_param_rejected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for qp in ["tenant=tnt_a", "tenant_id=tnt_a", "tenantId=tnt_a", "tenantID=tnt_a"]:
            res = await client.get(f"/health?{qp}")
            assert res.status_code == 400
            data = res.json()
            assert data["error"]["code"] == "TENANT_OVERRIDE_REJECTED"


@pytest.mark.asyncio
async def test_tenant_override_via_json_body_rejected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Top-level tenant field
        res = await client.post(
            "/auth/login",
            json={"email": "op.a@lathe.test", "password": "x", "tenant_id": "tnt_a"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "TENANT_OVERRIDE_REJECTED"

        # Nested tenant field
        res2 = await client.post(
            "/auth/login",
            json={"email": "op.a@lathe.test", "password": "x", "nested": {"tenantId": "tnt_b"}},
        )
        assert res2.status_code == 400
        assert res2.json()["error"]["code"] == "TENANT_OVERRIDE_REJECTED"
