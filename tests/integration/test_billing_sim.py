import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.auth import create_session_token
from app.config import settings
from scripts.seed import seed_database


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    settings.SQL_AUTH_MODE = "sqlite"
    settings.SQLITE_PATH = ":memory:"
    settings.BLOB_AUTH_MODE = "memory"
    settings.ENABLE_TEST_HOOKS = True

    from app.adapters import sql as sql_module
    from app.adapters import blob as blob_module

    sql_module._CLIENT_INSTANCE = None
    blob_module._BLOB_INSTANCE = None

    await seed_database()


@pytest.mark.asyncio
async def test_billing_disabled_by_default():
    # settings.FEATURE_BILLING_SIM is False by default
    token = create_session_token("usr_op_a", "tnt_a", "Operator", "op.a@lathe.test")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/billing/plans", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_billing_settle_flow():
    orig_flag = settings.FEATURE_BILLING_SIM
    settings.FEATURE_BILLING_SIM = True
    try:
        # Tenant B starts on Basic plan
        token_b_op = create_session_token("usr_op_b", "tnt_b", "Operator", "op.b@lathe.test")
        token_b_vw = create_session_token("usr_vw_b", "tnt_b", "Viewer", "view.b@lathe.test")
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Plans catalogue
            res = await ac.get("/billing/plans", headers={"Authorization": f"Bearer {token_b_op}"})
            assert res.status_code == 200
            plans = res.json()["plans"]
            assert len(plans) == 2

            # 2. Viewer cannot create pledge
            res = await ac.post(
                "/billing/pledges",
                json={"target_plan": "Pro"},
                headers={"Authorization": f"Bearer {token_b_vw}"},
            )
            assert res.status_code == 403
            assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"

            # 3. Create pledge as Operator
            res = await ac.post(
                "/billing/pledges",
                json={"target_plan": "Pro"},
                headers={"Authorization": f"Bearer {token_b_op}"},
            )
            assert res.status_code == 201
            pledge_id = res.json()["pledge_id"]
            assert pledge_id.startswith("plg_")

            # 4. Settle with invalid voucher
            res = await ac.post(
                f"/billing/pledges/{pledge_id}/settle",
                json={"voucher": "INVALID_CODE"},
                headers={"Authorization": f"Bearer {token_b_op}"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "VALIDATION_ERROR"

            # 5. Settle with BENCH-CLEAR
            res = await ac.post(
                f"/billing/pledges/{pledge_id}/settle",
                json={"voucher": "BENCH-CLEAR"},
                headers={"Authorization": f"Bearer {token_b_op}"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "settled"
            assert data["receipt"]["plan"] == "Pro"
            assert "LR-" in data["receipt"]["receipt_no"]

            # 6. Verify idempotent settle
            res_repeat = await ac.post(
                f"/billing/pledges/{pledge_id}/settle",
                json={"voucher": "BENCH-CLEAR"},
                headers={"Authorization": f"Bearer {token_b_op}"},
            )
            assert res_repeat.status_code == 200
            assert res_repeat.json()["receipt"]["receipt_no"] == data["receipt"]["receipt_no"]

            # 7. Check receipts
            res_receipts = await ac.get(
                "/billing/receipts", headers={"Authorization": f"Bearer {token_b_op}"}
            )
            assert res_receipts.status_code == 200
            assert len(res_receipts.json()["receipts"]) >= 1

            # 8. Verify tenant plan is upgraded to Pro
            res_sub = await ac.get(
                "/subscription", headers={"Authorization": f"Bearer {token_b_op}"}
            )
            assert res_sub.json()["plan"] == "Pro"
    finally:
        settings.FEATURE_BILLING_SIM = orig_flag
