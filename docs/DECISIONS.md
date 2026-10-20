# Lathe Engineering Decisions Log (DECISIONS.md)

This log records architecture, contract, and infrastructure decisions made during development.

---

## ADR-01: Starter Kit Absence & Adapter Pattern
- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** The challenge specification noted an organiser-supplied starter kit would be provided, but none was delivered.
- **Decision:** Build modular adapters for SQL (`SqlClient`), Blob (`BlobClient`), Auth (`AuthProvider`), and Processor (`Processor`) behind strict interfaces.
- **Consequence:** If an organiser starter arrives later, domain logic remains intact and only adapter implementations are swapped.

## ADR-02: Strict Tenant-Override Guard
- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** FR-02 and case rules mandate that tenant identity comes only from the verified session. Any client-supplied tenant override in header, query param, or JSON body must be rejected with 400 `TENANT_OVERRIDE_REJECTED`.
- **Decision:** Implemented early ASGI middleware (`RequestIdAndTenantOverrideMiddleware`) that inspects query parameter keys, headers starting with `X-Tenant*`, and performs deep JSON inspection for keys matching `tenant`, `tenant_id`, `tenantId`, `tenantID` (case-insensitive).
- **Consequence:** Prevents any handler from ever receiving or acting on client-supplied tenant fields.

## ADR-03: Idempotency Key Binary Collation
- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** In standard SQL Server collation, case differences in keys (`Key-1` vs `key-1`) collide.
- **Decision:** Explicitly define `idempotency_key NVARCHAR(128) COLLATE Latin1_General_100_BIN2 NOT NULL` in `migrations/001_runs.sql`.
- **Consequence:** Exact case-sensitive matching for idempotency keys as specified in [docs/04_DATABASE.md](file:///d:/R3/hacks/docs/04_DATABASE.md) §9.

## ADR-04: Non-destructive Request Body Caching in Middleware
- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** Reading `await request.body()` in ASGI middleware drains the stream for downstream FastAPI route handlers unless preserved.
- **Decision:** Read `request.body()` once, check size, parse JSON, store both `request.state.body_bytes` and `request.state.body_json`, and restore `request._receive`. Downstream routes read from `request.state.body_json` directly.
- **Consequence:** Zero redundant parsing and no ASGI stream exhaustion hangs.

## ADR-05: Concurrency Retry with Jitter on Atomic Reservation
- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** High concurrency on identical tenant usage rows can produce transient database locks or deadlocks.
- **Decision:** Implemented bounded exponential backoff with retry (up to 10 attempts) within the atomic accept transaction for transient lock/busy errors.
- **Consequence:** Concurrency suite passes 10x consecutively with 100% quota precision and zero leaked slots.

## ADR-06: Project Rebranding to TextForge and Flagged Commerce Settle
- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** Project name updated from "lathe" to "TextForge". Tier 2 commercial simulation (TextForge Settle) required without impacting Tier 0 scope.
- **Decision:** Rebranded public UI titles, wordmark, and package metadata to TextForge while keeping underlying database collations and auth seeds backward-compatible. Implemented `app/routers/billing.py` with test vouchers (`BENCH-CLEAR`, `BENCH-DECLINE`, etc.) strictly controlled by `FEATURE_BILLING_SIM`.
- **Consequence:** Clean editorial UI and commerce demonstration with zero risk to Tier 0 scored surface area.

