# Evidence A11 — Post-Acceptance Failure Recording (Test Hook)

### Run Creation: HTTP 201
```json
{
  "run_id": "6eb86cd7-bc28-4d59-9a22-51ac74c6c998",
  "status": "Failed",
  "operation": "validate",
  "replayed": false,
  "created_at": "2026-10-20T08:43:47.813170+00:00"
}
```

### Recorded Terminal Failure: HTTP 200
```json
{
  "run_id": "6eb86cd7-bc28-4d59-9a22-51ac74c6c998",
  "status": "Failed",
  "error": {
    "code": "FORCED_FAILURE",
    "message": "Run failed after acceptance."
  }
}
```
