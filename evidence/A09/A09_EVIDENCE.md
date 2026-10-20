# Evidence A09 — Idempotency and Replay Resolution

### First Run: HTTP 201
```json
{
  "run_id": "048642a2-2af4-4c32-87f0-f3cf8aee0c11",
  "status": "Succeeded",
  "operation": "validate",
  "replayed": false,
  "created_at": "2026-10-20T08:43:47.723101+00:00"
}
```

### Matching Replay: HTTP 200
```json
{
  "run_id": "048642a2-2af4-4c32-87f0-f3cf8aee0c11",
  "status": "Succeeded",
  "operation": "validate",
  "replayed": true,
  "created_at": "2026-10-20T08:43:47.714520+00:00"
}
```

### Changed Input with Same Key: HTTP 409
```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Idempotency key has already been used with different input or operation.",
    "details": {}
  }
}
```
