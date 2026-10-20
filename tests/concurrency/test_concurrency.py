import asyncio
import json
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from scripts.seed import seed_database
from tests.harness import harness


@pytest_asyncio.fixture(autouse=True)
async def setup_test_env():
    settings.SQL_AUTH_MODE = "sqlite"
    settings.SQLITE_PATH = "lathe_concurrency.db"
    settings.BLOB_AUTH_MODE = "memory"
    settings.ENABLE_TEST_HOOKS = True

    from app.adapters import sql as sql_module
    from app.adapters import blob as blob_module
    sql_module._CLIENT_INSTANCE = None
    blob_module._BLOB_INSTANCE = None

    await seed_database()


async def get_token_for(client: AsyncClient, email: str) -> str:
    res = await client.post("/auth/login", json={"email": email, "password": settings.SEED_PASSWORD})
    assert res.status_code == 200
    return res.json()["token"]


@pytest.mark.asyncio
async def test_a08_quota_boundary_concurrency():
    """
    Test A08: Tenant B (Basic: 3 max) has 1 slot left.
    Fire 20 concurrent requests -> exactly 1 accepted, 19 rejected with 429 QUOTA_EXHAUSTED.
    """
    # Set Tenant B today's used count to 2 (1 slot remaining out of 3)
    harness.set_quota("tnt_b", 2)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.b@lathe.test")
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)

        import uuid
        test_run_prefix = str(uuid.uuid4())[:8]

        async def send_req(i: int):
            return await client.post(
                "/runs",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Idempotency-Key": f"conc-a08-{test_run_prefix}-{i}",
                },
            )

        # Fire 20 concurrent requests
        tasks = [send_req(i) for i in range(20)]
        responses = await asyncio.gather(*tasks)

        accepted = [r for r in responses if r.status_code == 201]
        quota_exhausted = [r for r in responses if r.status_code == 429]
        others = [r for r in responses if r.status_code not in (201, 429)]
        if others:
            print("OTHER STATUSES:", [(r.status_code, r.text) for r in others])

        assert len(accepted) == 1
        assert len(quota_exhausted) == 19
        assert quota_exhausted[0].json()["error"]["code"] == "QUOTA_EXHAUSTED"

        # Check subscription snapshot confirms exactly 3 used (0 remaining)
        sub_res = await client.get("/subscription", headers={"Authorization": f"Bearer {token}"})
        sub_data = sub_res.json()
        assert sub_data["used_today"] == 3
        assert sub_data["remaining"] == 0


@pytest.mark.asyncio
async def test_a09_simultaneous_identical_keys():
    """
    Test A09: 10 concurrent requests with identical Idempotency-Key ->
    Exactly 1 run row created in database, no duplication or crash.
    """
    harness.reset_tenant("tnt_a")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.a@lathe.test")
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)

        async def send_req():
            return await client.post(
                "/runs",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Idempotency-Key": "same-key-simultaneous",
                },
            )

        tasks = [send_req() for _ in range(10)]
        responses = await asyncio.gather(*tasks)

        # Every response must be either 201 Created or 200 OK (replay)
        status_codes = [r.status_code for r in responses]
        assert all(s in (200, 201) for s in status_codes)

        # Check all share the exact same run_id
        run_ids = {r.json()["run_id"] for r in responses}
        assert len(run_ids) == 1

        # Check total runs in list is exactly 1
        runs_res = await client.get("/runs", headers={"Authorization": f"Bearer {token}"})
        runs = runs_res.json()["runs"]
        matching_runs = [r for r in runs if r["run_id"] in run_ids]
        assert len(matching_runs) == 1
