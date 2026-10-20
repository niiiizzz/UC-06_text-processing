# Evidence A07 — Tenant Isolation & Override Guard

### Cross-Tenant Lookup as Tenant B: HTTP 404
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Run not found.",
    "details": {}
  }
}
```

### Tenant Override in Header: HTTP 400
```json
{
  "error": {
    "code": "TENANT_OVERRIDE_REJECTED",
    "message": "Tenant override via header is forbidden. Identity is determined by session only.",
    "details": {}
  }
}
```
