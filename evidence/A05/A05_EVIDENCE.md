# Evidence A05 — Invalid Process Rejected with 400

HTTP 400
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Batch contains invalid rows and cannot be processed.",
    "details": {
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
}
```
