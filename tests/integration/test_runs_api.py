import json
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from scripts.seed import seed_database


import pytest_asyncio


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


async def get_token_for(client: AsyncClient, email: str) -> str:
    res = await client.post("/auth/login", json={"email": email, "password": settings.SEED_PASSWORD})
    assert res.status_code == 200
    return res.json()["token"]


@pytest.mark.asyncio
async def test_a02_validate_valid_fixture():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.a@lathe.test")
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)

        res = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": "test-a02-1"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "Succeeded"
        assert data["operation"] == "validate"

        run_id = data["run_id"]
        res_result = await client.get(
            f"/runs/{run_id}/result",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_result.status_code == 200
        result = res_result.json()["result"]
        assert result["valid_rows"] == 2
        assert result["invalid_rows"] == 0
        assert result["issues"] == []


@pytest.mark.asyncio
async def test_a03_validate_invalid_fixture():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.a@lathe.test")
        with open("tests/fixtures/invalid.json") as f:
            payload = json.load(f)

        res = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": "test-a03-1"},
        )
        assert res.status_code == 201
        run_id = res.json()["run_id"]

        res_result = await client.get(
            f"/runs/{run_id}/result",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_result.status_code == 200
        result = res_result.json()["result"]
        assert result["valid_rows"] == 2
        assert result["invalid_rows"] == 4
        assert len(result["issues"]) == 4


@pytest.mark.asyncio
async def test_a04_process_valid_fixture():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.a@lathe.test")  # Pro Operator
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)
        payload["operation"] = "process"

        res = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": "test-a04-1"},
        )
        assert res.status_code == 201
        run_id = res.json()["run_id"]

        res_result = await client.get(
            f"/runs/{run_id}/result",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_result.status_code == 200
        data = res_result.json()["result"]
        assert data["summary"]["input_rows"] == 2
        assert data["summary"]["output_characters"] == 16
        assert data["rows"][0]["output"] == "HELLO HELLO"
        assert data["rows"][1]["output"] == "world"


@pytest.mark.asyncio
async def test_a05_invalid_process_returns_400_no_debit():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.a@lathe.test")
        with open("tests/fixtures/invalid.json") as f:
            payload = json.load(f)
        payload["operation"] = "process"

        # Check quota before
        sub_before = await client.get("/subscription", headers={"Authorization": f"Bearer {token}"})
        used_before = sub_before.json()["used_today"]

        res = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": "test-a05-1"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"
        assert "issues" in res.json()["error"]["details"]

        # Check quota after (must be unchanged)
        sub_after = await client.get("/subscription", headers={"Authorization": f"Bearer {token}"})
        assert sub_after.json()["used_today"] == used_before


@pytest.mark.asyncio
async def test_a06_role_and_plan_permissions():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Viewer tries to submit -> 403 FORBIDDEN_ROLE
        viewer_token = await get_token_for(client, "view.a@lathe.test")
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)

        res_viewer = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {viewer_token}", "Idempotency-Key": "test-a06-vw"},
        )
        assert res_viewer.status_code == 403
        assert res_viewer.json()["error"]["code"] == "FORBIDDEN_ROLE"

        # Basic Operator tries to process -> 403 FORBIDDEN_PLAN
        basic_op_token = await get_token_for(client, "op.b@lathe.test")
        payload["operation"] = "process"
        res_basic = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {basic_op_token}", "Idempotency-Key": "test-a06-basic"},
        )
        assert res_basic.status_code == 403
        assert res_basic.json()["error"]["code"] == "FORBIDDEN_PLAN"


@pytest.mark.asyncio
async def test_a07_tenant_isolation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token_a = await get_token_for(client, "op.a@lathe.test")
        token_b = await get_token_for(client, "op.b@lathe.test")

        # Tenant A creates a run
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)
        res_a = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token_a}", "Idempotency-Key": "test-a07-a"},
        )
        run_id_a = res_a.json()["run_id"]

        # Tenant B lists runs: must not see Tenant A's run
        res_b_list = await client.get("/runs", headers={"Authorization": f"Bearer {token_b}"})
        runs_b = res_b_list.json()["runs"]
        assert all(r["run_id"] != run_id_a for r in runs_b)

        # Tenant B directly fetches Tenant A's run: must get 404 NOT_FOUND
        res_b_get = await client.get(
            f"/runs/{run_id_a}/result",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert res_b_get.status_code == 404
        assert res_b_get.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_a09_idempotency_replay():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.a@lathe.test")
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)

        key = "test-replay-key-1"
        # 1. First run -> 201 Created
        res1 = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key},
        )
        assert res1.status_code == 201
        run_id = res1.json()["run_id"]
        assert res1.json()["replayed"] is False

        # 2. Replay with identical input -> 200 OK with same run_id, replayed=True
        res2 = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key},
        )
        assert res2.status_code == 200
        assert res2.json()["run_id"] == run_id
        assert res2.json()["replayed"] is True

        # 3. Same key with changed input -> 409 IDEMPOTENCY_CONFLICT
        mutated_payload = json.loads(json.dumps(payload))
        mutated_payload["records"][0]["text"] = "Changed"
        res3 = await client.post(
            "/runs",
            json=mutated_payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key},
        )
        assert res3.status_code == 409
        assert res3.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


@pytest.mark.asyncio
async def test_a11_forced_failure_hook():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await get_token_for(client, "op.a@lathe.test")
        with open("tests/fixtures/valid.json") as f:
            payload = json.load(f)

        key = "test-forced-failure-1"
        res = await client.post(
            "/runs",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Idempotency-Key": key,
                "X-Test-Force-Failure": "true",
            },
        )
        assert res.status_code == 201
        assert res.json()["status"] == "Failed"
        run_id = res.json()["run_id"]

        # Fetch result shows error envelope
        res_res = await client.get(
            f"/runs/{run_id}/result",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_res.status_code == 200
        assert res_res.json()["status"] == "Failed"
        assert res_res.json()["error"]["code"] == "FORCED_FAILURE"

        # Replay returns Failed without error
        replay = await client.post(
            "/runs",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key},
        )
        assert replay.status_code == 200
        assert replay.json()["status"] == "Failed"
        assert replay.json()["replayed"] is True
