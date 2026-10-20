# 05 · API — Lathe

Base URL: `https://<container-app-fqdn>` (dev) · local `http://localhost:8000`
Format: JSON, UTF-8. Time: ISO-8601 UTC.
Scored routes: **exactly six**. Auth helper routes (`/auth/*`) support the verified session. Billing routes (`/billing/*`) exist only behind `FEATURE_BILLING_SIM`.

---

## 1. Conventions

### 1.1 Authentication
- Session cookie `lathe_session` (HttpOnly, Secure, SameSite=Lax) **or** `Authorization: Bearer <token>` (for test clients).
- Tenant, user, and role come **only** from the verified session.

### 1.2 Tenant override rejection
Any of the following → `400 TENANT_OVERRIDE_REJECTED`:
- Query params or JSON keys named `tenant`, `tenant_id`, `tenantId`, `tenantID` (case-insensitive, at any depth of the top-level object and each record)
- Any header starting with `X-Tenant`

### 1.3 Error envelope
```json
{ "error": { "code": "QUOTA_EXHAUSTED", "message": "Daily quota used up.", "details": { } } }
```

### 1.4 Error code table

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Wrong body shape, missing/extra fields, bad operation, row count outside 1–10, process with invalid rows |
| 400 | `PAYLOAD_TOO_LARGE` | Body > 64 KiB |
| 400 | `MISSING_IDEMPOTENCY_KEY` | `Idempotency-Key` header absent/blank/too long (>128) |
| 400 | `TENANT_OVERRIDE_REJECTED` | See 1.2 |
| 401 | `UNAUTHENTICATED` | No/invalid/expired session |
| 403 | `FORBIDDEN_ROLE` | Viewer tries to submit |
| 403 | `FORBIDDEN_PLAN` | Basic tries `process` |
| 403 | `SUBSCRIPTION_SUSPENDED` | Suspended tenant tries to submit |
| 404 | `NOT_FOUND` | Unknown run ID **or** another tenant's run ID |
| 409 | `IDEMPOTENCY_CONFLICT` | Same key, changed operation/input |
| 409 | `RUN_IN_PROGRESS` | Replay of a key whose run is still Running |
| 429 | `QUOTA_EXHAUSTED` | No quota slot left; includes `Retry-After` (seconds to 00:00 UTC) |
| 503 | `DEPENDENCY_UNAVAILABLE` | SQL/Blob unavailable |

## 2. `GET /health` (public)

`200`
```json
{ "status": "ok", "version": "a1b2c3d" }
```
No tenant data, no dependency details.

## 3. `GET /tools` (auth: any role)

Lists what the caller's plan can do.

`200`
```json
{
  "tools": [
    { "operation": "validate", "available": true,  "description": "Check a batch against rules R1–R4." },
    { "operation": "process",  "available": false, "reason": "Pro plan required",
      "description": "Transform text: trim, apply case, repeat." }
  ],
  "limits": { "min_rows": 1, "max_rows": 10, "max_body_bytes": 65536 }
}
```

## 4. `GET /subscription` (auth: any role)

`200`
```json
{
  "tenant": { "id": "tnt_b", "name": "Harbor & Pine Labs" },
  "plan": "Basic",
  "status": "Active",
  "daily_limit": 3,
  "used_today": 1,
  "remaining": 2,
  "resets_at": "2026-10-21T00:00:00Z",
  "role": "Operator"
}
```
`tenant.id` is read-only information for display; it is never accepted as input.

## 5. `POST /runs` (auth: Operator)

Headers: `Idempotency-Key: <1–128 chars>` (required), `Content-Type: application/json`.

Body:
```json
{
  "operation": "validate",
  "records": [
    { "record_id": "T01", "text": "Hello", "repeat": 2, "mode": "UPPER" },
    { "record_id": "T02", "text": "WORLD", "repeat": 1, "mode": "LOWER" }
  ]
}
```
Exactly two top-level keys (`operation`, `records`); each record has exactly four keys.

### 5.1 Check order (contract)
1. Authenticate → 401
2. Tenant-override guard → 400
3. Role is Operator → 403 `FORBIDDEN_ROLE`
4. Subscription Active → 403 `SUBSCRIPTION_SUSPENDED`
5. Plan permits the requested operation → 403 `FORBIDDEN_PLAN` (needs `operation` parsed; if `operation` itself is invalid → 400)
6. `Idempotency-Key` present → 400
7. Body size ≤ 64 KiB, JSON object, exact keys, `records` is a list of 1–10 objects with exactly four keys → 400
8. `process` only: any invalid row → 400 with `issues` in `details`
9. Transaction: insert run → (duplicate? replay path) → reserve quota → (none? 429)
10. Execute → persist → respond

### 5.2 Responses

**201 Created** (new accepted run; always terminal)
```json
{ "run_id": "6f1c0a9e-6d3b-4c1b-9a74-3f7e0d9b2a11", "status": "Succeeded",
  "operation": "process", "replayed": false, "created_at": "2026-10-20T10:41:07Z" }
```

**200 OK** (matching replay of a terminal run; body is the original, `replayed: true`)
```json
{ "run_id": "6f1c0a9e-…", "status": "Failed", "operation": "process", "replayed": true,
  "created_at": "2026-10-20T10:41:07Z" }
```

**Other:** `409 IDEMPOTENCY_CONFLICT`, `409 RUN_IN_PROGRESS`, `429 QUOTA_EXHAUSTED`, plus the 400/401/403 set above.

A run that fails **after** acceptance still returns `201` with `"status": "Failed"` (the request was accepted and debited; the failure is a recorded outcome).

### 5.3 Test hook (dev sandbox only)
When `ENABLE_TEST_HOOKS=true`, header `X-Test-Force-Failure: true` makes the run fail **after acceptance** (post-`Running`, pre-result). Ignored entirely when the flag is off. This is the "shared test hook" for A11.

## 6. `GET /runs` (auth: any role)

`200`
```json
{ "runs": [
  { "run_id": "…", "operation": "process", "status": "Succeeded",
    "row_count": 2, "valid_rows": 2, "invalid_rows": 0,
    "created_at": "…", "finished_at": "…" }
] }
```
Newest first, max 50, **tenant-scoped**.

## 7. `GET /runs/{id}/result` (auth: any role)

Succeeded `validate`:
```json
{ "run_id": "…", "status": "Succeeded",
  "result": { "operation": "validate", "valid_rows": 2, "invalid_rows": 0, "issues": [] } }
```
Succeeded `process`:
```json
{ "run_id": "…", "status": "Succeeded",
  "result": { "operation": "process",
    "summary": { "input_rows": 2, "output_characters": 16 },
    "rows": [ { "record_id": "T01", "output": "HELLO HELLO", "length": 11 },
              { "record_id": "T02", "output": "world", "length": 5 } ],
    "issues": [] } }
```
Failed:
```json
{ "run_id": "…", "status": "Failed",
  "error": { "code": "FORCED_FAILURE", "message": "Run failed after acceptance." } }
```
Running: `{ "run_id": "…", "status": "Running" }`
Unknown or other tenant's ID: `404 NOT_FOUND` (identical body for both, so existence is not leaked).

Valid-looking but malformed IDs (non-UUID) → also `404`.

## 8. Validation specification

### 8.1 Algorithm (`services/validation.py`)
```
seen = set()
for i, rec in enumerate(records, start=1):
    issues_for_row = []
    # R1
    rid = rec["record_id"]
    if type(rid) is not str or not rid.strip() or len(rid.strip()) > 20: R1
    elif rid.strip() in seen: R1          # later occurrence only
    (add rid.strip() to seen if it is a valid-format string, after the check)
    # R2
    txt = rec["text"]
    if type(txt) is not str: R2
    else:
        t = txt.strip(" ")                # trim spaces (use .strip() — include tabs/newlines)
        if not (1 <= len(t) <= 80) or not t.isascii(): R2
    # R3
    rp = rec["repeat"]
    if type(rp) is not int or not (1 <= rp <= 3): R3     # type() is, not isinstance → rejects bool
    # R4
    if type(rec["mode"]) is not str or rec["mode"].strip() not in ("UPPER","LOWER"): R4
    issues += one entry per failed rule {row_index:i, field, rule_id}
    row is invalid if issues_for_row non-empty  → invalid_rows += 1 once
```
Field → rule map: `record_id→R1`, `text→R2`, `repeat→R3`, `mode→R4`.
Strings are trimmed first, so `" T01 "` equals `"T01"`. IDs remain **case-sensitive** (`t01` ≠ `T01`).
Duplicate detection rule: the **first** occurrence is valid; **later** occurrences are the R1 failures.

### 8.2 Required fixtures
Valid (`tests/fixtures/valid.json`): T01/Hello/2/UPPER, T02/WORLD/1/LOWER.
Invalid (`tests/fixtures/invalid.json`): the two valid rows, then four copies of row 1 (`Hello`, 2, `UPPER`) given fresh IDs X1–X4, each with exactly one mutation:

| Row | Fresh ID | Mutation | Resulting row | Fails |
|---|---|---|---|---|
| 3 | X1 | "repeat T01" = reuse the ID `T01` | `T01 / Hello / 2 / UPPER` | R1 (later duplicate) |
| 4 | X2 | `text = ""` | `X2 / "" / 2 / UPPER` | R2 |
| 5 | X3 | `repeat = 0` | `X3 / Hello / 0 / UPPER` | R3 |
| 6 | X4 | `mode = "TITLE"` | `X4 / Hello / 2 / TITLE` | R4 |

Row 3's mutation overwrites its fresh ID, so X1 never appears in the final payload. This is my reading of "repeat T01"; confirm against the organiser's fixture file if one arrives.

Expected `validate`: `valid_rows 2`, `invalid_rows 4`, issues:
```json
[ {"row_index":3,"field":"record_id","rule_id":"R1"},
  {"row_index":4,"field":"text","rule_id":"R2"},
  {"row_index":5,"field":"repeat","rule_id":"R3"},
  {"row_index":6,"field":"mode","rule_id":"R4"} ]
```

### 8.3 Processor (`services/processor.py`, pure)
```python
def process(rows: list[dict]) -> dict:
    out, total = [], 0
    for r in rows:
        t = r["text"].strip()
        t = t.upper() if r["mode"] == "UPPER" else t.lower()
        s = " ".join([t] * r["repeat"])
        out.append({"record_id": r["record_id"], "output": s, "length": len(s)})
        total += len(s)
    return {"summary": {"input_rows": len(rows), "output_characters": total},
            "rows": out, "issues": []}
```
Expected for the valid fixture: `HELLO HELLO` (11), `world` (5), `output_characters = 16`.
Since the supplied processor didn't arrive, keep this file isolated; swap in the organiser's if it shows up (no extra marks for rewriting it).

## 9. Tier 2 — Lathe Settle (simulated billing), flagged

> Our own sandbox payment flow. Different vocabulary and shape from any real gateway: **pledge → settle → receipt**. Never handles real card data, never calls out of the app.

All routes: Operator only, tenant from session, enabled only when `FEATURE_BILLING_SIM=true`.

| Route | Purpose |
|---|---|
| `GET /billing/plans` | Catalogue: Basic ₹0, Pro ₹499/month (display only) |
| `POST /billing/pledges` | Body `{target_plan:"Pro"}`. Creates a pledge `plg_…` (status `open`, expires in 15 min). Rejects if already on that plan (409) |
| `POST /billing/pledges/{id}/settle` | Body `{voucher:"BENCH-CLEAR"}`. Returns pledge status and, on success, a receipt |
| `GET /billing/receipts` | Tenant's receipts |

Test vouchers (sandbox only, documented in UI):

| Voucher | Result |
|---|---|
| `BENCH-CLEAR` | `settled` → plan becomes Pro immediately |
| `BENCH-DECLINE` | `declined` (reason `INSUFFICIENT_BENCH_FUNDS`), plan unchanged |
| `BENCH-HOLD` | `held`; auto-clears to `settled` on the next `GET` after ~5 s (computed lazily; no scheduler) |
| `BENCH-EXPIRE` | pledge `expired` |

Receipt:
```json
{ "receipt_no": "LR-20261020-0001", "pledge_id": "plg_…", "plan": "Pro",
  "amount_minor": 49900, "currency": "INR", "settled_at": "…",
  "signature": "<hex HMAC-SHA256(secret, pledge_id|tenant_id|plan|amount_minor|settled_at)>" }
```
Rules:
- Plan change is applied **server-side only**, after the server decides the outcome; the client's claim is never trusted.
- Settle is idempotent per pledge (second settle returns the same receipt).
- Upgrade does **not** reset or edit `DailyUsage`. The new limit applies to the remaining allowance of the current UTC day.
- No downgrade, no refund, no proration, no renewal job. Suspension remains a harness action.
- Receipts verify with `GET /billing/receipts` (signature recomputed server-side).

## 10. Auth helper routes (not among the six scored routes)

| Route | Notes |
|---|---|
| `POST /auth/login` | `{email,password}` → sets cookie, returns `{token, user:{display_name, role, tenant_name}}`. Generic error on failure; rate-limited. |
| `POST /auth/logout` | Clears cookie. |
| `GET /auth/me` | Principal summary for the SPA. |

## 11. cURL cheat sheet

```bash
BASE=https://<fqdn>
TOKEN=$(curl -s $BASE/auth/login -H 'content-type: application/json' \
  -d '{"email":"op.a@lathe.test","password":"'$SEED_PASSWORD'"}' | jq -r .token)

curl -s $BASE/health
curl -s -H "Authorization: Bearer $TOKEN" $BASE/subscription

curl -s -X POST $BASE/runs \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: demo-001" -H 'content-type: application/json' \
  -d @tests/fixtures/process_valid.json -i
# replay → 200, same run_id
# same key + changed input → 409 IDEMPOTENCY_CONFLICT
```

## 12. Contract tests (map to checks)

| Test | Check |
|---|---|
| validate valid fixture → 2/0/[] | A02 |
| validate invalid fixture → 2/4 + 4 issues | A03 |
| process valid → exact rows/summary; restart; GET result | A04 |
| invalid process, wrong shape, 11 rows → 400, no run, no debit | A05 |
| no auth → 401; Viewer submit → 403; Basic process → 403 (no debit) | A06 |
| Tenant B can't list A; A's run → 404; tenant override → 400 | A07 |
| Basic 3 then 429; concurrent at 1 slot → exactly one | A08 |
| exhausted + matching key → 200; changed input → 409; simultaneous same key → ≤ 1 run | A09 |
| suspended → 403 no debit; reads still 200 | A10 |
| forced failure → Failed, error recorded, 1 slot; replay → same failure, no re-exec | A11 |
