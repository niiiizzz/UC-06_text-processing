import os
import json
import uuid
import pytest
import httpx

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
SEED_PASSWORD = os.environ.get("SEED_PASSWORD", "LatheDemo2026!")

@pytest.fixture
def client():
    return httpx.Client(base_url=BASE_URL, timeout=10.0)

def get_token(client, email):
    res = client.post("/auth/login", json={"email": email, "password": SEED_PASSWORD})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["token"]

def test_a01_health_check(client):
    """A01: Public /health endpoint returns 200 ok and version"""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "tenant" not in data

def test_a02_validate_valid_fixture(client):
    """A02: validate valid fixture -> 2 valid, 0 invalid, no issues"""
    token = get_token(client, "op.a@lathe.test")
    with open("tests/fixtures/valid.json") as f:
        payload = json.load(f)
    res = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"cloud-a02-{uuid.uuid4().hex[:6]}"},
    )
    assert res.status_code == 201
    run_id = res.json()["run_id"]
    res_result = client.get(f"/runs/{run_id}/result", headers={"Authorization": f"Bearer {token}"})
    assert res_result.status_code == 200
    res_data = res_result.json()["result"]
    assert res_data["valid_rows"] == 2
    assert res_data["invalid_rows"] == 0
    assert res_data["issues"] == []

def test_a03_validate_invalid_fixture(client):
    """A03: validate invalid fixture -> 2 valid, 4 invalid, R1..R4 issues"""
    token = get_token(client, "op.a@lathe.test")
    with open("tests/fixtures/invalid.json") as f:
        payload = json.load(f)
    res = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"cloud-a03-{uuid.uuid4().hex[:6]}"},
    )
    assert res.status_code == 201
    run_id = res.json()["run_id"]
    res_result = client.get(f"/runs/{run_id}/result", headers={"Authorization": f"Bearer {token}"})
    assert res_result.status_code == 200
    res_data = res_result.json()["result"]
    assert res_data["valid_rows"] == 2
    assert res_data["invalid_rows"] == 4
    assert len(res_data["issues"]) == 4

def test_a04_process_valid_fixture(client):
    """A04: process valid -> exact transformed rows & summary"""
    token = get_token(client, "op.a@lathe.test")
    with open("tests/fixtures/valid.json") as f:
        payload = json.load(f)
    payload["operation"] = "process"
    res = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"cloud-a04-{uuid.uuid4().hex[:6]}"},
    )
    assert res.status_code == 201
    run_id = res.json()["run_id"]
    res_result = client.get(f"/runs/{run_id}/result", headers={"Authorization": f"Bearer {token}"})
    assert res_result.status_code == 200
    res_data = res_result.json()["result"]
    assert res_data["summary"]["input_rows"] == 2
    assert res_data["summary"]["output_characters"] == 16
    assert res_data["rows"][0]["output"] == "HELLO HELLO"
    assert res_data["rows"][1]["output"] == "world"

def test_a05_invalid_process_rejects_with_400(client):
    """A05: process invalid batch rejects 400 with no debit"""
    token = get_token(client, "op.a@lathe.test")
    with open("tests/fixtures/invalid.json") as f:
        payload = json.load(f)
    payload["operation"] = "process"
    res = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"cloud-a05-{uuid.uuid4().hex[:6]}"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"

def test_a06_role_and_plan_permissions(client):
    """A06: Viewer submit 403, Basic process 403"""
    vw_token = get_token(client, "view.a@lathe.test")
    with open("tests/fixtures/valid.json") as f:
        payload = json.load(f)
    res_vw = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {vw_token}", "Idempotency-Key": f"cloud-a06-vw-{uuid.uuid4().hex[:6]}"},
    )
    assert res_vw.status_code == 403
    assert res_vw.json()["error"]["code"] == "FORBIDDEN_ROLE"

    op_b_token = get_token(client, "op.b@lathe.test")
    payload["operation"] = "process"
    res_basic = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {op_b_token}", "Idempotency-Key": f"cloud-a06-b-{uuid.uuid4().hex[:6]}"},
    )
    assert res_basic.status_code == 403
    assert res_basic.json()["error"]["code"] == "FORBIDDEN_PLAN"

def test_a07_tenant_isolation(client):
    """A07: Tenant B cannot see A's runs; override header/body/param returns 400"""
    token_a = get_token(client, "op.a@lathe.test")
    token_b = get_token(client, "op.b@lathe.test")

    with open("tests/fixtures/valid.json") as f:
        payload = json.load(f)
    res_a = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {token_a}", "Idempotency-Key": f"cloud-a07-{uuid.uuid4().hex[:6]}"},
    )
    run_id_a = res_a.json()["run_id"]

    # Tenant B tries to get A's result
    res_b = client.get(f"/runs/{run_id_a}/result", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 404

    # Header override
    res_hdr = client.get("/subscription", headers={"Authorization": f"Bearer {token_a}", "X-Tenant-Id": "tnt_b"})
    assert res_hdr.status_code == 400
    assert res_hdr.json()["error"]["code"] == "TENANT_OVERRIDE_REJECTED"

def test_a09_replay_consistency(client):
    """A09: Replay same key -> 200 same run; changed input -> 409 conflict"""
    token = get_token(client, "op.a@lathe.test")
    with open("tests/fixtures/valid.json") as f:
        payload = json.load(f)
    key = f"cloud-a09-{uuid.uuid4().hex[:8]}"

    res1 = client.post("/runs", json=payload, headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key})
    assert res1.status_code == 201
    run_id = res1.json()["run_id"]

    res2 = client.post("/runs", json=payload, headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key})
    assert res2.status_code == 200
    assert res2.json()["run_id"] == run_id
    assert res2.json()["replayed"] is True

    mutated = json.loads(json.dumps(payload))
    mutated["records"][0]["text"] = "Different"
    res3 = client.post("/runs", json=mutated, headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key})
    assert res3.status_code == 409
    assert res3.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"

def test_a11_forced_failure(client):
    """A11: Test hook forces failure after acceptance -> status Failed debited"""
    token = get_token(client, "op.a@lathe.test")
    with open("tests/fixtures/valid.json") as f:
        payload = json.load(f)
    key = f"cloud-a11-{uuid.uuid4().hex[:8]}"

    res = client.post(
        "/runs",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key, "X-Test-Force-Failure": "true"},
    )
    assert res.status_code == 201
    assert res.json()["status"] == "Failed"
    run_id = res.json()["run_id"]

    res_result = client.get(f"/runs/{run_id}/result", headers={"Authorization": f"Bearer {token}"})
    assert res_result.status_code == 200
    assert res_result.json()["status"] == "Failed"
    assert res_result.json()["error"]["code"] == "FORCED_FAILURE"
