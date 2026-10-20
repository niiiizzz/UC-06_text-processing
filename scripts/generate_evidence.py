import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import uuid
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from scripts.seed import seed_database
from tests.harness import harness

client = TestClient(app)

def run_and_save_evidence():
    print("[*] Generating verified evidence files for A01–A11...")

    # Initialize in-memory SQLite and mock storage
    settings.SQL_AUTH_MODE = "sqlite"
    settings.SQLITE_PATH = "evidence_verification.db"
    settings.BLOB_AUTH_MODE = "memory"
    settings.ENABLE_TEST_HOOKS = True

    import asyncio
    asyncio.run(seed_database())

    # Helper: login
    def login(email):
        res = client.post("/auth/login", json={"email": email, "password": settings.SEED_PASSWORD})
        assert res.status_code == 200
        return res.json()["token"]

    token_a_op = login("op.a@lathe.test")
    token_a_vw = login("view.a@lathe.test")
    token_b_op = login("op.b@lathe.test")
    token_b_vw = login("view.b@lathe.test")

    # A02: validate valid fixture
    with open("tests/fixtures/valid.json") as f:
        valid_payload = json.load(f)
    res_a02 = client.post("/runs", json=valid_payload, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": "ev-a02-key"})
    run_id_a02 = res_a02.json()["run_id"]
    res_a02_result = client.get(f"/runs/{run_id_a02}/result", headers={"Authorization": f"Bearer {token_a_op}"})
    with open("evidence/A02/A02_EVIDENCE.md", "w") as f:
        f.write("# Evidence A02 — Validate Valid Batch\n\n```json\n" + json.dumps(res_a02_result.json(), indent=2) + "\n```\n")

    # A03: validate invalid fixture
    with open("tests/fixtures/invalid.json") as f:
        invalid_payload = json.load(f)
    res_a03 = client.post("/runs", json=invalid_payload, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": "ev-a03-key"})
    run_id_a03 = res_a03.json()["run_id"]
    res_a03_result = client.get(f"/runs/{run_id_a03}/result", headers={"Authorization": f"Bearer {token_a_op}"})
    with open("evidence/A03/A03_EVIDENCE.md", "w") as f:
        f.write("# Evidence A03 — Validate Invalid Batch (Rules R1–R4)\n\n```json\n" + json.dumps(res_a03_result.json(), indent=2) + "\n```\n")

    # A04: process valid fixture
    proc_payload = json.loads(json.dumps(valid_payload))
    proc_payload["operation"] = "process"
    res_a04 = client.post("/runs", json=proc_payload, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": "ev-a04-key"})
    run_id_a04 = res_a04.json()["run_id"]
    res_a04_result = client.get(f"/runs/{run_id_a04}/result", headers={"Authorization": f"Bearer {token_a_op}"})
    with open("evidence/A04/A04_EVIDENCE.md", "w") as f:
        f.write("# Evidence A04 — Process Valid Batch\n\n```json\n" + json.dumps(res_a04_result.json(), indent=2) + "\n```\n")

    # A05: invalid process rejection
    proc_invalid = json.loads(json.dumps(invalid_payload))
    proc_invalid["operation"] = "process"
    res_a05 = client.post("/runs", json=proc_invalid, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": "ev-a05-key"})
    with open("evidence/A05/A05_EVIDENCE.md", "w") as f:
        f.write(f"# Evidence A05 — Invalid Process Rejected with 400\n\nHTTP {res_a05.status_code}\n```json\n" + json.dumps(res_a05.json(), indent=2) + "\n```\n")

    # A06: Role & Plan permissions
    res_a06_vw = client.post("/runs", json=valid_payload, headers={"Authorization": f"Bearer {token_a_vw}", "Idempotency-Key": "ev-a06-vw"})
    res_a06_plan = client.post("/runs", json=proc_payload, headers={"Authorization": f"Bearer {token_b_op}", "Idempotency-Key": "ev-a06-plan"})
    with open("evidence/A06/A06_EVIDENCE.md", "w") as f:
        f.write("# Evidence A06 — Role and Plan Enforcements\n\n")
        f.write(f"### Viewer Submit: HTTP {res_a06_vw.status_code}\n```json\n{json.dumps(res_a06_vw.json(), indent=2)}\n```\n\n")
        f.write(f"### Basic Process: HTTP {res_a06_plan.status_code}\n```json\n{json.dumps(res_a06_plan.json(), indent=2)}\n```\n")

    # A07: Tenant isolation
    res_a07_cross = client.get(f"/runs/{run_id_a04}/result", headers={"Authorization": f"Bearer {token_b_op}"})
    res_a07_hdr = client.get("/subscription", headers={"Authorization": f"Bearer {token_a_op}", "X-Tenant-Id": "tnt_b"})
    with open("evidence/A07/A07_EVIDENCE.md", "w") as f:
        f.write("# Evidence A07 — Tenant Isolation & Override Guard\n\n")
        f.write(f"### Cross-Tenant Lookup as Tenant B: HTTP {res_a07_cross.status_code}\n```json\n{json.dumps(res_a07_cross.json(), indent=2)}\n```\n\n")
        f.write(f"### Tenant Override in Header: HTTP {res_a07_hdr.status_code}\n```json\n{json.dumps(res_a07_hdr.json(), indent=2)}\n```\n")

    # A08: Quota limit & 429
    harness.set_quota("tnt_b", 3)
    res_a08_exhausted = client.post("/runs", json=valid_payload, headers={"Authorization": f"Bearer {token_b_op}", "Idempotency-Key": "ev-a08-key"})
    with open("evidence/A08/A08_EVIDENCE.md", "w") as f:
        f.write(f"# Evidence A08 — Daily Quota Exhaustion Guard\n\nHTTP {res_a08_exhausted.status_code}\nRetry-After: {res_a08_exhausted.headers.get('Retry-After')}\n```json\n" + json.dumps(res_a08_exhausted.json(), indent=2) + "\n```\n")

    # A09: Replay
    replay_key = "ev-a09-replay-key"
    res_a09_1 = client.post("/runs", json=valid_payload, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": replay_key})
    res_a09_2 = client.post("/runs", json=valid_payload, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": replay_key})
    mutated = json.loads(json.dumps(valid_payload))
    mutated["records"][0]["text"] = "Mutated"
    res_a09_3 = client.post("/runs", json=mutated, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": replay_key})
    with open("evidence/A09/A09_EVIDENCE.md", "w") as f:
        f.write("# Evidence A09 — Idempotency and Replay Resolution\n\n")
        f.write(f"### First Run: HTTP {res_a09_1.status_code}\n```json\n{json.dumps(res_a09_1.json(), indent=2)}\n```\n\n")
        f.write(f"### Matching Replay: HTTP {res_a09_2.status_code}\n```json\n{json.dumps(res_a09_2.json(), indent=2)}\n```\n\n")
        f.write(f"### Changed Input with Same Key: HTTP {res_a09_3.status_code}\n```json\n{json.dumps(res_a09_3.json(), indent=2)}\n```\n")

    # A10: Subscription suspended
    harness.set_subscription_status("tnt_a", "Suspended")
    res_a10_post = client.post("/runs", json=valid_payload, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": "ev-a10-key"})
    res_a10_get = client.get(f"/runs/{run_id_a04}/result", headers={"Authorization": f"Bearer {token_a_op}"})
    harness.set_subscription_status("tnt_a", "Active")
    with open("evidence/A10/A10_EVIDENCE.md", "w") as f:
        f.write("# Evidence A10 — Suspended Subscription Protection\n\n")
        f.write(f"### Submit Run on Suspended Tenant: HTTP {res_a10_post.status_code}\n```json\n{json.dumps(res_a10_post.json(), indent=2)}\n```\n\n")
        f.write(f"### Read Existing Past Result on Suspended Tenant: HTTP {res_a10_get.status_code}\n```json\n{json.dumps(res_a10_get.json(), indent=2)}\n```\n")

    # A11: Forced failure hook
    hook_key = "ev-a11-hook-key"
    res_a11 = client.post("/runs", json=valid_payload, headers={"Authorization": f"Bearer {token_a_op}", "Idempotency-Key": hook_key, "X-Test-Force-Failure": "true"})
    run_id_a11 = res_a11.json()["run_id"]
    res_a11_result = client.get(f"/runs/{run_id_a11}/result", headers={"Authorization": f"Bearer {token_a_op}"})
    with open("evidence/A11/A11_EVIDENCE.md", "w") as f:
        f.write("# Evidence A11 — Post-Acceptance Failure Recording (Test Hook)\n\n")
        f.write(f"### Run Creation: HTTP {res_a11.status_code}\n```json\n{json.dumps(res_a11.json(), indent=2)}\n```\n\n")
        f.write(f"### Recorded Terminal Failure: HTTP {res_a11_result.status_code}\n```json\n{json.dumps(res_a11_result.json(), indent=2)}\n```\n")

    print("[+] Successfully generated all evidence files for A02–A11.")

if __name__ == "__main__":
    run_and_save_evidence()
