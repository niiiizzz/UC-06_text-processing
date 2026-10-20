# TextForge (formerly Lathe)

> Multi-tenant, subscription-based text processing SaaS on Azure Container Apps.  
> Advantix × Rajalakshmi Engineering Challenge (UC-06).  
> **Contract-first · Tenant-safe · Idempotent · Exact Quota Accounting**

---

## 1. What TextForge Does

TextForge validates batches of short text requests against four non-negotiable rules and, for Pro subscriptions, executes deterministic text transformations (`repeat`, `UPPER`/`LOWER`) and persists the output securely in Azure Blob Storage.

### Exact Contract Rules (R1–R4)
- **R1 (`record_id`)**: Max 20 characters, strictly unique within the batch. Earlier instances remain valid; later duplicate IDs fail with `DUPLICATE_RECORD_ID`. Case-sensitive.
- **R2 (`text`)**: 1–80 ASCII characters. Trailing whitespace is trimmed prior to validation.
- **R3 (`repeat`)**: Integer in range `[1, 3]`. Strict integer check (`type(x) is int`); booleans (which inherit from int in Python) and numeric strings are rejected.
- **R4 (`mode`)**: Exact string enum: `"UPPER"` or `"LOWER"`.

---

## 2. Architecture & Surface Area

TextForge adheres strictly to the UC-06 competition bounds:

- **Exactly 6 Scored Endpoints**:
  1. `GET /health`: Public health check, returns status and build hash.
  2. `GET /tools`: Lists tools available for caller's role and plan.
  3. `GET /subscription`: Returns tenant plan, status, and atomic quota balance.
  4. `POST /runs`: Accepts a batch of 1–10 rows; orders replay verification before quota debit; reserves slot atomically.
  5. `GET /runs`: Lists tenant's past runs (newest first).
  6. `GET /runs/{run_id}/result`: Retrieves detailed execution proof or issue list.
- **Auth Helper Endpoints**:
  - `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- **Tier 2 Flagged Commerce (TextForge Settle)**:
  - `GET /billing/plans`, `POST /billing/pledges`, `POST /billing/pledges/{id}/settle`, `GET /billing/receipts`
  - Enabled strictly behind `FEATURE_BILLING_SIM=true`.

---

## 3. Security & Multi-Tenancy Invariants

1. **Session-Only Tenant Identity**: Tenant ID is derived exclusively from verified JWT cookie (`lathe_session`) or Bearer token.
2. **Tenant Override Rejection**: Any query param, header (`X-Tenant*`), or JSON payload property containing `tenant_id` or variants returns `400 TENANT_OVERRIDE_REJECTED`.
3. **Atomic Quota Reservation**: Quota is debited using a single conditional SQL update (`WHERE used_count < daily_limit`) wrapped in an immediate transaction. Replays check unique constraint `UX_Runs_tenant_key` before debiting quota.
4. **Uniform 404 on Cross-Tenant Access**: Querying another tenant's `run_id` returns a uniform `404 NOT_FOUND` to prevent identifier probing.
5. **Private Blob Storage**: Result container has public access disabled; blobs are accessible only via the authenticated API proxy.

---

## 4. Local Quickstart

### Prerequisites
- Python 3.11+ (or `py -3`)
- Node.js 18+ & npm

### Running the Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Seed development database
py -3 scripts/seed.py

# Launch development server
py -3 -m uvicorn app.main:app --port 8000 --reload
```

### Running the Frontend
```bash
cd web
npm install
npm run dev
```

### Running the Test Suite
```bash
# Unit, integration, and concurrency tests (22/22 green)
py -3 -m pytest tests/unit tests/integration tests/concurrency -v

# Run concurrency suite 10x with zero quota leakage
py -3 scripts/run_concurrency_10x.py
```

---

## 5. Deployment to Azure

Terraform manages **EXACTLY two resources** per the competition rules:
1. `azurerm_container_app.api`
2. `azurerm_storage_container.results` (private)

All other resources (Resource Group, Log Analytics, Azure SQL, Managed Identity) are referenced via data sources.

```bash
# Validate Terraform configuration
terraform -chdir=infra init
terraform -chdir=infra validate

# Deploy to dev sandbox
./scripts/deploy.sh dev

# Run automated acceptance verification (A01–A12)
./scripts/verify.sh dev
```

---

## 6. Pre-Seeded Demo Accounts

| Organization | Role | Email | Password | Plan |
|---|---|---|---|---|
| Northwind Print Co. | Operator | `op.a@lathe.test` | `LatheDemo2026!` | Pro (10 runs/day) |
| Northwind Print Co. | Viewer | `view.a@lathe.test` | `LatheDemo2026!` | Pro (Read-only) |
| Harbor Logistics | Operator | `op.b@lathe.test` | `LatheDemo2026!` | Basic (3 runs/day) |
| Harbor Logistics | Viewer | `view.b@lathe.test` | `LatheDemo2026!` | Basic (Read-only) |

---

## 7. Known Limits
- **Crash Recovery**: Mid-run worker crashes leave the status in `Running` (out of hackathon scope).
- **Billing Sandbox**: Simulated vouchers (`BENCH-CLEAR`, `BENCH-DECLINE`, `BENCH-HOLD`, `BENCH-EXPIRE`) only; no external financial networks contacted.
