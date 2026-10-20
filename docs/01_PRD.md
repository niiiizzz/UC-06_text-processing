# 01 · PRD — Lathe (Text Processing Tool SaaS)

> Source of truth: `UC-06_text-processing.docx` (Advantix × Rajalakshmi University, Cloud & SaaS Engineering Challenge, Revision 2).
> If this PRD ever conflicts with the case document, **the case document wins**. Flag the conflict in `docs/DECISIONS.md`.

---

## 1. Product summary

**Lathe** is a small, subscription-based, multi-tenant SaaS that turns batches of short text requests into validated, transformed output.

- **Basic** customers **validate** batches (up to 3 accepted runs per UTC day, per tenant).
- **Pro** customers **validate and process** batches (up to 10 accepted runs per UTC day, per tenant) and download the transformed-text report.

Tagline: *Text, turned to spec.*
(Product name is a placeholder. Rename in one place: `web/src/brand.ts` and `app/config.py`.)

## 2. Context and constraints (non-negotiable)

| # | Constraint | Source |
|---|---|---|
| C1 | Azure is mandatory. Deployed as a SaaS on cloud (Azure Container Apps). | Industry brief |
| C2 | Terraform for infrastructure. Exactly **two scored resources**: one Container App, one **private** Blob container. Two environment parameter files (`dev`, `test`). Scripts: deploy, verify, cleanup. | Case doc |
| C3 | Agent skill file(s) in `.md` that invoke the scripts, with a fresh-session replay. | Industry brief + case doc |
| C4 | Six routes, two operations, four row rules, two SQL tables, one pure processing helper. | Case doc |
| C5 | Two tenants, two roles (Operator, Viewer), two plans (Basic, Pro), subscription status, daily quota, request deduplication, two UI screens. | Case doc |
| C6 | Tenant identity comes **only** from the verified session. Never from request data or an editable browser field. | Case doc |
| C7 | Synthetic data and sandbox only. | Case doc |
| C8 | Excluded from scored scope: queues, remote ERP calls, payment checkout, signup, approval workflows, schedulers, extra admin screens. **Extra features earn no marks.** | Case doc |
| C9 | Cloud evidence must come from the real deployment. Local execution earns no cloud-deployment credit. | Case doc |
| C10 | Build window: 11:00 → 16:00 on the day. Checking 16:00 → 17:00. | Case doc |

### 2.1 The "starter kit" gap

The case document says organisers supply a starter (login middleware, SQL/Blob wrappers, Terraform scaffolding, test harness, processor). **Nothing was delivered.** This PRD therefore plans to build all of it, behind thin adapter interfaces so that, if the organiser starter shows up on the day, we can swap it in without touching business logic.

Adapters we own: `AuthProvider`, `SqlClient`, `BlobClient`, `Processor`, `Harness`.

## 3. Personas

| Persona | Who | Can do | Cannot do |
|---|---|---|---|
| **Operator** | Staff member at a tenant who submits batches | Submit runs, read tenant history, read results | Read other tenants |
| **Viewer** | Read-only teammate / auditor | Read tenant history and results, see plan and quota | Submit anything |
| **Panel reviewer** (judge) | Evaluates against A01–A12 | Observes | — |

Two seeded tenants: **Tenant A** (Pro, Active) and **Tenant B** (Basic, Active). Each has one Operator and one Viewer.

## 4. Scope tiers

Build in this order. **Do not start a lower tier until the one above passes its gate.**

### Tier 0 — Scored core (must ship; maps to A01–A12)
- Terraform: Container App + private Blob container; `dev.tfvars` and `test.tfvars`; `scripts/deploy.sh`, `verify.sh`, `cleanup.sh`.
- API: `GET /health`, `GET /tools`, `GET /subscription`, `POST /runs`, `GET /runs`, `GET /runs/{id}/result`.
- Rules R1–R4, supplied-style processor, persisted runs/results (SQL `Runs`, `DailyUsage`; results in private Blob).
- Auth (verified session), roles, plan gates, subscription status, atomic quota, idempotency.
- Two screens: **Run tools** (plan + remaining quota + submit) and **History** (list + selected result).
- `skills/text-tools/SKILL.md`, tests, evidence folder, README, AIFE log.

### Tier 1 — Product shell (unscored, but makes it look like a real SaaS)
- Landing page (hero, how it works, pricing, FAQ, footer).
- Split-screen **Login** page.
- App shell: sidebar, top bar, account menu, empty/error/loading states.

### Tier 2 — Simulated commerce (unscored, optional, feature-flagged, default OFF during acceptance runs)
- Sign-up tab (sandbox: invite-only message + demo account chips; real provisioning only if time remains).
- **Lathe Settle**: our own sandbox payment flow ("pledge → settle → receipt") to upgrade Basic → Pro. See `05_API.md §9` and `SKILLS.md §11`.
- Billing page in the app shell.

> **Cut line:** if at 14:00 any Tier 0 check is red, Tier 1 and Tier 2 work stops. No exceptions.

## 5. Functional requirements

IDs are referenced from tests, commits and `09_IMPLEMENTATION.md`.

### 5.1 Platform
- **FR-01** Authenticated sessions are verified server-side; each request resolves `{user_id, tenant_id, role}` from the session only.
- **FR-02** Any request carrying a tenant override (body field, query param, or header such as `X-Tenant-Id`) is rejected with 400.
- **FR-03** `GET /health` is public and returns no tenant data.
- **FR-04** All other routes require authentication: 401 when absent/invalid.

### 5.2 Plans, roles, subscription
- **FR-05** Basic: `validate` only, 3 accepted runs per UTC day. Pro: `validate` and `process`, 10 accepted runs per UTC day. Allowance is **shared** by every user in the tenant.
- **FR-06** Operator can submit. Viewer can read only. Both read their own tenant's history.
- **FR-07** Suspended subscription: no new runs (403, no debit). Existing results remain readable.
- **FR-08** Role, plan, and subscription denials return 403.

### 5.3 Runs
- **FR-09** `POST /runs` requires an `Idempotency-Key`. Uniqueness is `(tenant_id, key)`.
- **FR-10** Matching operation+input returns the original terminal run (200) with no re-execution and no debit. Changed input returns 409. A replay of a still-Running run returns 409 `RUN_IN_PROGRESS`.
- **FR-11** Quota slot is reserved **atomically** at acceptance. Every accepted unique run counts once, **including a processing failure**. Rejected requests count zero. No refund. No manual quota editing.
- **FR-12** Matching replay is checked **before** remaining quota is enforced.
- **FR-13** Input bounds: JSON body `{operation, records}`; `operation ∈ {validate, process}`; 1–10 rows; ≤ 64 KiB; missing/extra fields or wrong shapes → 400 **before acceptance**.
- **FR-14** Run lifecycle: persist `Running` **before** invoking the helper; finish `Succeeded` or `Failed`. A shared test hook can force a failure after acceptance. Failure is persisted and exposed. No retries or crash recovery.
- **FR-15** `GET /runs` lists only the caller's tenant's runs. `GET /runs/{id}/result` returns `{run_id, status, result}`; Failed runs return a recorded error instead of `result`; unknown or other-tenant run ID → 404.

### 5.4 Text rules (UC-06)
| Rule | Condition |
|---|---|
| **R1** | `record_id` is a non-empty string, ≤ 20 characters, unique within the batch (only **later** occurrences are duplicates; IDs are case-sensitive). |
| **R2** | `text` is 1–80 ASCII characters after trimming spaces. |
| **R3** | `repeat` is an integer 1–3 inclusive. Booleans and numeric strings are rejected. |
| **R4** | `mode` is `UPPER` or `LOWER`. |

- **FR-16** `validate` returns `valid_rows`, `invalid_rows`, `issues[]` with 1-based `row_index`, `field`, `rule_id`. Every failing rule is reported; each invalid row is counted once.
- **FR-17** `process` rejects any invalid row with 400 (no run, no debit). Otherwise it saves helper output `{summary, rows, issues: []}`. Each result row has `record_id`, `output`, `length`. Summary has `input_rows`, `output_characters`.
- **FR-18** Processor trims text, applies case, and joins `repeat` copies with a single space. Row order is preserved.

### 5.5 UI (scored)
- **FR-19** *Run tools* screen: plan, subscription status, remaining quota, operation picker, JSON/row editor, submit. Viewer sees it read-only.
- **FR-20** *History* screen: tenant run list; selecting a run shows the processed rows and summary (or the recorded failure).

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Correctness | Quota and idempotency hold under concurrency (A08, A09). |
| Security | Zero cross-tenant exposure. Permission bypass is a disqualifying defect. See `08_AUTH_SECURITY.md`. |
| Durability | Results survive an app restart (A04). Stored in Blob + `Runs`. |
| Observability | Structured JSON logs with `request_id`, `tenant_id`, `run_id`. No raw text content in logs. |
| Reproducibility | `terraform plan` after apply shows **no changes** (A01). |
| Performance | p95 < 500 ms for a 10-row batch on the sandbox. (Soft target.) |
| Accessibility | WCAG 2.1 AA contrast; keyboard-navigable; visible focus. |
| Cost | Container App min replicas 1 (or 0 with warm-up note); smallest SQL tier available in the sandbox. |

## 7. Success metrics

1. All **12 acceptance checks (A01–A12)** pass on the **deployed** dev sandbox, with redacted evidence in `evidence/`.
2. Fresh-session replay (A12) succeeds from `skills/text-tools/SKILL.md` alone.
3. Panel questions answered confidently: tenant checks, quota concurrency, replay.
4. Tier 1 shell is live and coherent. Tier 2 is demoable but never at the cost of Tier 0.

## 8. Assumptions (confirm with organisers where marked ⚑)

1. ⚑ Stack is ours to choose because "the supplied starter" didn't arrive. **Chosen:** Python 3.12 + FastAPI, React + Vite + TypeScript + Tailwind, single container.
2. ⚑ Azure core (resource group, ACR, Container Apps environment, Azure SQL, storage account, managed identity, Log Analytics) is provisioned by organisers on the day. If not, run `infra/bootstrap/` (see `07_SETUP.md`).
3. ⚑ Seeded tenants/users/subscriptions may arrive from organisers. If so, adapt `migrations/003_platform_seed.sql` and the `Harness` adapter.
4. Oversized body (> 64 KiB) returns **400** `PAYLOAD_TOO_LARGE` (case doc says "reject with 400"), not 413.
5. Missing `Idempotency-Key` on `POST /runs` returns **400**.
6. A record that is not a JSON object with exactly the four keys is a **shape** error (400). A record with the four keys but a wrong *value type* (e.g. `repeat: "2"`, `repeat: true`, `text: 5`) is a **row** error reported against that field's rule.
7. Idempotency fingerprint is SHA-256 of the canonical JSON of the **raw** `{operation, records}` (sorted keys, no whitespace).
8. Third table(s) for tenants/users are *platform seed tables*, not scored tables. Scored tables are exactly `Runs` and `DailyUsage`.

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Azure provisioning delays / region quota | Med | High | Bootstrap script ready; fallback regions listed in `07_SETUP.md`; ask organisers early. |
| Quota race conditions | Med | High | Conditional `UPDATE … WHERE used_count < limit` inside one transaction; concurrency test A08/A09. |
| Terraform plan drift (A01) | Med | High | Ignore-changes only where justified; pin provider; second-plan check in `verify.sh`. |
| Scope creep into landing/billing | High | High | Tier gates + 14:00 cut line. |
| Python `bool` is an `int` (R3 trap) | High | Med | Explicit `type(x) is int` check + unit tests. |
| Secrets in Terraform state | Med | Med | Sensitive vars; remote state in private storage; no secrets in git. |

## 10. Out of scope (do not build)

Queues, schedulers, remote ERP calls, real payment gateways, approval workflows, tenant admin UI, user management UI, email, webhooks, analytics dashboards, multi-region, retries/crash recovery.

## 11. Glossary

- **Accepted run** — passed all pre-acceptance checks and consumed a quota slot.
- **Terminal** — `Succeeded` or `Failed`.
- **Replay** — a `POST /runs` with a previously used `(tenant, Idempotency-Key)`.
- **Harness** — organiser/test tooling that resets fixtures/quota and suspends subscriptions; **not** exposed via the product API.
