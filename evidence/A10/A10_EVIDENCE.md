# Evidence A10 — Suspended Subscription Protection

### Submit Run on Suspended Tenant: HTTP 403
```json
{
  "error": {
    "code": "SUBSCRIPTION_SUSPENDED",
    "message": "This subscription is suspended. Past results are still readable.",
    "details": {}
  }
}
```

### Read Existing Past Result on Suspended Tenant: HTTP 200
```json
{
  "run_id": "4aeb22f2-b0a7-4f5e-a3ef-6cacabcaefb6",
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
