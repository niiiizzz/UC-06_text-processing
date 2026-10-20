# Evidence A06 — Role and Plan Enforcements

### Viewer Submit: HTTP 403
```json
{
  "error": {
    "code": "FORBIDDEN_ROLE",
    "message": "Only Operators can submit runs. Viewers have read-only access.",
    "details": {}
  }
}
```

### Basic Process: HTTP 403
```json
{
  "error": {
    "code": "FORBIDDEN_PLAN",
    "message": "The 'process' tool requires a Pro plan. Upgrade to unlock.",
    "details": {}
  }
}
```
