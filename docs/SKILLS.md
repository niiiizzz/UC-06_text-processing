---
name: senior-sde-saas-builder
description: Operating standard for an AI agent building a multi-tenant, subscription-based SaaS on Azure the way a senior software engineer would. Use for any task in this repository that designs, implements, tests, deploys, or reviews SaaS behaviour (tenancy, auth, quota, idempotency, subscriptions, simulated billing, IaC, UI).
---

# SKILLS.md — How the agent builds a SaaS product

This file defines **how you work**, not what Lathe is. Product facts live in `docs/`. When the two disagree, the case document (`UC-06_text-processing.docx`) wins, then `docs/01_PRD.md`, then this file.

Read order for any task: `AGENTS.md` → `docs/01_PRD.md` → the doc for your lane → this file.

---

## 1. Operating principles

1. **Contract first.** The API contract, error codes, and check order are the product. Code serves the contract; never the reverse.
2. **Correctness before polish.** Tenant isolation, quota, and idempotency beat every visual or convenience feature.
3. **Smallest safe step.** Small diffs, each independently testable and revertible.
4. **Evidence over assertion.** Nothing is "done" without a test, command output, or captured response.
5. **Boring technology.** Prefer the simplest mechanism that provably works (one DB transaction beats a clever cache).
6. **Make illegal states unrepresentable.** Constraints in the database, types in code, validation at the edge.
7. **Fail closed.** On doubt about identity, tenant, entitlement, or input: deny, and explain safely.
8. **Honest scope.** Do only what the scope tiers allow. Say clearly what is simulated, assumed, or unfinished.

## 2. The working loop (every task)

1. **Understand** — restate the goal, FR IDs, and affected checks (A01–A12). List unknowns.
2. **Plan** — files to touch, tests to write, risks, rollback. Post it before coding. Get a human go for auth/quota/idempotency/Terraform changes.
3. **Test-first or test-alongside** — write the failing test that encodes the requirement.
4. **Implement** — minimal code; parameterised SQL; no new routes/tables.
5. **Verify** — run unit → integration → concurrency → e2e as relevant. Run linters/type checks.
6. **Review yourself** — read your diff as a reviewer; run the checklist in §14.
7. **Record** — update docs/DECISIONS if behaviour or choices changed; append to `evidence/AIFE_LOG.md`.
8. **Hand off** — summary: what changed, how verified, risks, next step.

## 3. Requirements and scope discipline

- Map every change to an FR ID and a scope tier. If it maps to none, don't build it.
- Treat the "excluded" list as hard: queues, schedulers, remote ERP, payment checkout, signup, approval workflows, extra admin screens are **outside scored scope**. Simulations of signup/billing are Tier 2, feature-flagged, default off for acceptance runs, and only after Tier 0 is green.
- Ambiguity protocol: choose the interpretation closest to the case document, write it in `docs/DECISIONS.md` (decision, reason, alternatives), and surface it to the human. Don't silently guess on contract-visible behaviour.

## 4. Multi-tenancy

- **Tenant identity comes from the verified session only.** Never from body, query, headers, cookies the user can edit, or UI fields.
- Every query on tenant-owned data filters by the principal's `tenant_id`. No exceptions, no "admin" shortcuts.
- Unknown and foreign resources are indistinguishable: identical 404 body.
- Unique constraints are scoped by tenant where keys are tenant-chosen (`tenant_id + idempotency_key`).
- Shared allowances are per tenant, not per user.
- Test isolation adversarially: list, fetch by ID, overrides in body/query/header, replaying another tenant's key.

## 5. Authentication and authorisation

- Passwords: argon2id; constant-time compare; generic failure messages; throttle.
- Sessions: signed, short-lived, HttpOnly + Secure + SameSite cookies; pinned algorithm; re-check user/tenant state per request.
- Authorisation lives in **one** function evaluated **before any write**: role → subscription status → plan entitlement.
- UI restrictions are convenience only; the API must enforce everything independently.
- Never log credentials, tokens, cookies, or user text.

## 6. Subscriptions and entitlements

Model (sandbox):

| Concept | Rule |
|---|---|
| Plan | `Basic` (validate only, 3 runs/UTC day) · `Pro` (validate + process, 10 runs/UTC day) |
| Status | `Active` · `Suspended` |
| Suspended | New runs → 403, no debit; reads continue |
| Allowance | Per tenant per UTC day; reset is the date change, never an API |
| Entitlement checks | Derived server-side from the tenant row, never from the client |

Rules a senior engineer follows:
- Entitlements are **data-driven** (a small `PLANS` map: operations, daily_limit) so adding a plan is a data change, not a refactor.
- State transitions are explicit and logged (`plan.changed`, `subscription.suspended`).
- Changing plan mid-day never resets or edits usage; only the limit changes.
- No refunds, proration, or manual quota edits in this product.
- Keep billing concerns separate from run execution: runs read entitlements; billing only writes the plan.

## 7. Metering, quota, and concurrency

- **Reserve atomically**: one transaction that (a) inserts the run, (b) conditionally increments `DailyUsage` with `WHERE used_count < @limit`, (c) rolls back on zero rows affected.
- No read-then-write. No in-memory counters. No "check then act".
- Count **every accepted unique run**, including failures. Rejected requests count zero (they roll back).
- Retry deadlocks (1205) a bounded number of times with jitter; never retry non-idempotent side effects outside the transaction.
- UTC day computed by the database clock.
- Prove it with concurrency tests (threads/processes), repeated multiple times to catch flakiness.

## 8. Idempotency

- Required `Idempotency-Key` on mutating endpoints; scope `(tenant, key)`; enforced by a **unique index**.
- Store an **input fingerprint** (SHA-256 of canonical JSON). Same key + same fingerprint → return the original result; same key + different fingerprint → 409.
- Replay is evaluated **before** quota and never re-executes work or debits.
- A replay of an in-flight request → 409 `RUN_IN_PROGRESS` (never block indefinitely).
- Terminal states are immutable.

## 9. Validation and API design

- Validate at the edge, strictly: size cap before parsing, exact key sets, strict types (`type(x) is int` to reject booleans), bounded collections.
- Separate **shape errors** (400 before acceptance) from **row/value errors** (reported per row with 1-based index, field, and rule ID).
- Report every failing rule; count each invalid row once.
- Stable error envelope with machine-readable codes; no stack traces or SQL in responses.
- Status codes carry meaning: 401 unauthenticated, 403 forbidden, 404 not found/not yours, 409 conflict, 429 quota.
- Keep pure logic (validation, processing) free of I/O so it is trivially testable. **Do not rewrite or "improve" the supplied processor contract.**

## 10. Data and migrations

- Forward-only, numbered, idempotent migrations. Never edit an applied migration; add a new one.
- Constraints in the database (CHECK, UNIQUE, PK/FK). Indexes for known access patterns only.
- Parameterised queries exclusively. No string-built SQL.
- Store results in the private blob container; keep metadata in SQL; the API proxies content (no public URLs).
- Seed data is synthetic. Reset tooling lives in a harness CLI, never in product routes.

## 11. Simulated billing (own design: "Lathe Settle")

Purpose: demonstrate a subscription lifecycle without moving money and without cloning any real gateway's shape or vocabulary.

Flow: **Pledge → Settle → Receipt.**

1. **Pledge** — `POST /billing/pledges {target_plan}` creates `plg_…` (status `open`, 15-minute expiry, amount in minor units, currency INR).
2. **Settle** — `POST /billing/pledges/{id}/settle {voucher}` with a sandbox voucher:
   `BENCH-CLEAR` (settled), `BENCH-DECLINE` (declined), `BENCH-HOLD` (held, clears lazily after ~5 s on next read), `BENCH-EXPIRE` (expired).
3. **Receipt** — on success, the server stores a receipt with an HMAC-SHA256 signature over `pledge_id|tenant_id|plan|amount_minor|settled_at`, then **server-side** updates the tenant plan.

Non-negotiables:
- The server decides outcomes; the client never asserts "paid".
- Settle is idempotent per pledge.
- Operator only; tenant from the session; feature flag `FEATURE_BILLING_SIM`.
- Upgrade changes limits, not usage counters. No downgrade/refund/proration/renewal job (schedulers are excluded).
- No card numbers, no real PII, no outbound calls. Label every surface "Sandbox — no real payment".
- Keep it isolated in `app/routers/billing.py`, `app/services/billing.py`, migration `004`. Deleting these must not affect the scored build.

## 12. Infrastructure as code and deployment

- Terraform manages **only** the assigned resources: one Container App and one private Blob container. Everything else via data sources.
- Two env parameter files (`dev`, `test`); secrets via `TF_VAR_*`, never committed.
- Definition of IaC done: `fmt`, `validate`, `plan`, `apply`, `/health` 200, **second plan exit code 0**.
- Immutable images tagged by short git SHA. Rollback = deploy the previous tag.
- Managed identity for Azure access; no keys or SAS in code.
- Destructive operations (destroy, cleanup, DB reset) require explicit human confirmation each time; never target resources you don't own.
- Cloud evidence must come from the cloud deployment, not local runs.

## 13. Observability and operations

- Structured JSON logs with `request_id`, `tenant_id`, `user_id`, `run_id`, event name, latency. Never log payload text or secrets.
- `/health` is public, cheap, and reveals nothing about tenants or dependencies.
- Failures are recorded where the user can see them (run `Failed` with error code), not only in logs.
- Document known limitations (no crash recovery; in-memory login throttle) rather than hiding them.

## 14. Testing standard

| Level | What must exist |
|---|---|
| Unit | Each rule R1–R4 incl. bool/numeric-string traps, trimming, case-sensitivity, later-duplicate-only; processor; fingerprint |
| Integration | Accept transaction, quota boundary, replay decision table, terminal immutability |
| Concurrency | N parallel requests at one slot → exactly one accepted; parallel identical keys → one run |
| Contract/E2E | A01–A12 against the deployed URL with redacted evidence |
| Security | Cross-tenant, overrides, role/plan/suspension bypass attempts |
| Frontend | Request body contains only `operation` and `records`; error-state rendering; keyboard flow |

Rules: a flaky test is a defect; never "fix" with sleeps or retries. Deterministic fixtures. Run the suite before every push.

## 15. Frontend and UX craft

- Follow `docs/02_DESIGN.md` tokens exactly; no hard-coded colours.
- Avoid the "AI template" look: no gradients, glass, emoji icons, generic three-card grids, fake logos/metrics.
- Every state designed: loading, empty, error, forbidden, suspended, exhausted, viewer.
- Messages explain what happened and what to do next.
- Accessibility is a requirement: contrast, focus, labels, live regions, keyboard.
- Never rely on disabled buttons for security.

## 16. Security baseline (always on)

Least privilege, deny by default, parameterised queries, secrets out of git/logs/images, dependency hygiene (pin versions, lockfiles, audit; avoid brand-new releases), secure headers, private storage, input caps, uniform errors. Cross-tenant exposure or permission bypass is **release-blocking**.

## 17. Git, PRs, and reviews

- Short-lived branches; Conventional Commits referencing FR/A IDs (`feat(runs): atomic quota reserve (FR-11, A08)`).
- PR template: what/why, how tested, checks affected, risks, rollback.
- Self-review checklist before opening a PR:
  - [ ] Tenant only from principal
  - [ ] Parameterised SQL
  - [ ] No new routes/tables/screens beyond contract
  - [ ] Tests added; suite green
  - [ ] No secrets/PII/text in logs
  - [ ] Docs/DECISIONS updated
  - [ ] Evidence captured if a check is affected

## 18. Communication

- Short status updates: done / next / blocked.
- Quote exact errors and commands; never paraphrase a failure.
- Raise risks early with options and a recommendation.
- Never claim a check passes without showing the proof.

## 19. Stop conditions (halt and ask a human)

- Possible cross-tenant leak or auth bypass
- Quota/idempotency tests are flaky or failing
- Terraform plan shows changes on a clean second run
- A needed change is outside your lane or outside the scope tiers
- Contract conflict between documents
- Any destructive command, secret handling, or billing-simulation decision

## 20. Anti-patterns (do not do)

- Trusting `tenant_id` from the client
- Check-then-act quota logic; in-memory counters
- Enforcing uniqueness only in application code
- Rewriting the supplied processor; adding features "for completeness"
- Catching exceptions to hide failures; swallowing errors in the run lifecycle
- Putting secrets in Terraform outputs, logs, or screenshots
- Mixing simulation code into scored paths
- Declaring victory from local runs when cloud evidence is required
