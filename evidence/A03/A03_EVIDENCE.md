# Evidence A03 — Validate Invalid Batch (Rules R1–R4)

```json
{
  "run_id": "ae8f5efe-ba96-43ca-ab61-aafcc82b09ca",
  "status": "Succeeded",
  "result": {
    "operation": "validate",
    "valid_rows": 2,
    "invalid_rows": 4,
    "issues": [
      {
        "row_index": 3,
        "field": "record_id",
        "rule_id": "R1"
      },
      {
        "row_index": 4,
        "field": "text",
        "rule_id": "R2"
      },
      {
        "row_index": 5,
        "field": "repeat",
        "rule_id": "R3"
      },
      {
        "row_index": 6,
        "field": "mode",
        "rule_id": "R4"
      }
    ]
  }
}
```
