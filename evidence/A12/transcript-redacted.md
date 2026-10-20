# Evidence A12 — Fresh Session Replay Transcript

This transcript records the reproduction of the three mandatory scenarios from `skills/text-tools/SKILL.md` Section 6:
1. **Successful Run (validate & process)**
2. **Invalid Batch (Rules R1–R4 violation & rejection)**
3. **Forced Failure after acceptance (Test Hook)**

---

## 1. Scenario 1: Successful Run (A12 §6.1)

### Request
```http
POST /runs HTTP/1.1
Host: localhost:8000
Authorization: Bearer <TOKEN_TENANT_A_OPERATOR>
Idempotency-Key: skill-ok-1
Content-Type: application/json

{
  "operation": "process",
  "records": [
    { "record_id": "T01", "text": "Hello", "repeat": 2, "mode": "UPPER" },
    { "record_id": "T02", "text": "WORLD", "repeat": 1, "mode": "LOWER" }
  ]
}
```

### Response
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "run_id": "4b68ef50-c875-4d74-b529-6721096a60d9",
  "status": "Succeeded",
  "operation": "process",
  "replayed": false,
  "created_at": "2026-10-20T08:35:12.184000+00:00"
}
```

### Result Fetch (`GET /runs/4b68ef50-c875-4d74-b529-6721096a60d9/result`)
```json
{
  "run_id": "4b68ef50-c875-4d74-b529-6721096a60d9",
  "status": "Succeeded",
  "result": {
    "operation": "process",
    "summary": {
      "input_rows": 2,
      "output_characters": 16
    },
    "rows": [
      {
        "record_id": "T01",
        "output": "HELLO HELLO",
        "length": 11
      },
      {
        "record_id": "T02",
        "output": "world",
        "length": 5
      }
    ],
    "issues": []
  }
}
```

---

## 2. Scenario 2: Invalid Batch (A12 §6.2)

### Request 2a: Validate Invalid Fixture
```http
POST /runs HTTP/1.1
Host: localhost:8000
Authorization: Bearer <TOKEN_TENANT_A_OPERATOR>
Idempotency-Key: skill-invalid-validate
Content-Type: application/json

{
  "operation": "validate",
  "records": [
    { "record_id": "T01", "text": "Hello", "repeat": 2, "mode": "UPPER" },
    { "record_id": "T02", "text": "WORLD", "repeat": 1, "mode": "LOWER" },
    { "record_id": "T01", "text": "Hello", "repeat": 2, "mode": "UPPER" },
    { "record_id": "X2", "text": "", "repeat": 2, "mode": "UPPER" },
    { "record_id": "X3", "text": "Hello", "repeat": 0, "mode": "UPPER" },
    { "record_id": "X4", "text": "Hello", "repeat": 2, "mode": "TITLE" }
  ]
}
```

### Result (`GET /runs/{run_id}/result`)
```json
{
  "status": "Succeeded",
  "result": {
    "operation": "validate",
    "valid_rows": 2,
    "invalid_rows": 4,
    "issues": [
      { "row_index": 3, "field": "record_id", "rule_id": "R1" },
      { "row_index": 4, "field": "text", "rule_id": "R2" },
      { "row_index": 5, "field": "repeat", "rule_id": "R3" },
      { "row_index": 6, "field": "mode", "rule_id": "R4" }
    ]
  }
}
```

### Request 2b: Process Invalid Batch with New Key
```http
POST /runs HTTP/1.1
Host: localhost:8000
Authorization: Bearer <TOKEN_TENANT_A_OPERATOR>
Idempotency-Key: skill-invalid-process
Content-Type: application/json

{
  "operation": "process",
  "records": [ ...invalid records... ]
}
```

### Response
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Batch contains invalid rows and cannot be processed.",
    "details": {
      "issues": [
        { "row_index": 3, "field": "record_id", "rule_id": "R1" },
        { "row_index": 4, "field": "text", "rule_id": "R2" },
        { "row_index": 5, "field": "repeat", "rule_id": "R3" },
        { "row_index": 6, "field": "mode", "rule_id": "R4" }
      ]
    }
  }
}
```
*Note: Daily usage remains completely untouched (no run row created).*

---

## 3. Scenario 3: Forced Failure via Shared Test Hook (A12 §6.3)

### Request
```http
POST /runs HTTP/1.1
Host: localhost:8000
Authorization: Bearer <TOKEN_TENANT_A_OPERATOR>
Idempotency-Key: skill-forced-failure-1
X-Test-Force-Failure: true
Content-Type: application/json

{
  "operation": "process",
  "records": [
    { "record_id": "T01", "text": "Hello", "repeat": 2, "mode": "UPPER" },
    { "record_id": "T02", "text": "WORLD", "repeat": 1, "mode": "LOWER" }
  ]
}
```

### Response
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "run_id": "89b91730-84a1-432d-932f-4886616016e7",
  "status": "Failed",
  "operation": "process",
  "replayed": false,
  "created_at": "2026-10-20T08:35:16.891000+00:00"
}
```

### Result Fetch (`GET /runs/89b91730-84a1-432d-932f-4886616016e7/result`)
```json
{
  "run_id": "89b91730-84a1-432d-932f-4886616016e7",
  "status": "Failed",
  "error": {
    "code": "FORCED_FAILURE",
    "message": "Run failed after acceptance."
  }
}
```

### Replay Request (Same Key without Header)
```http
POST /runs HTTP/1.1
Idempotency-Key: skill-forced-failure-1

{ ...identical payload... }
```
### Replay Response
```http
HTTP/1.1 200 OK

{
  "run_id": "89b91730-84a1-432d-932f-4886616016e7",
  "status": "Failed",
  "operation": "process",
  "replayed": true,
  "created_at": "2026-10-20T08:35:16.891000+00:00"
}
```
*Note: Returns 200 with original Failed status without re-executing.*
