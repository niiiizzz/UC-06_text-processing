# 09 · PROJECT IMPLEMENTATION — Lathe

Day plan for a team of three. Build window **11:00 → 16:00**, checking **16:00 → 17:00**. Pre-event work (this docs set, repo skeleton, local stack) should be done **before** 9:00 where rules allow; confirm with organisers what may be prepared in advance.

---

## 1. Roles

| Person | Lane | Agents they supervise |
|---|---|---|
| **P1** | Infra + Data (Terraform, Docker, scripts, migrations, harness, SKILL.md) | Infra, Data |
| **P2** | Backend + QA (API, rules, quota, idempotency, tests, evidence) | Backend, QA |
| **P3** | Frontend + Planner (design system, screens, README, AIFE log) | Frontend, Planner |

## 2. Timeline

| Time | Milestone | Gate |
|---|---|---|
| 09:00–09:30 | Briefing. Confirm: stack freedom, Azure prerequisites, seed data, fixture files, test hook name | Questions in `DECISIONS.md` |
| 09:30–10:00 | Use-case provisioning. Verify UC-06 assignment, fixtures, access | — |
| 10:00–11:00 | **Infra window:** P1 gets Azure prerequisites verified (or runs bootstrap); P2 scaffolds API + local DB; P3 scaffolds web + tokens | **G0:** `az` login works, `terraform validate` ok, local `/health` 200 |
| 11:00–12:30 | **Wave 1:** migrations, auth, validation + processor, first Terraform apply with a placeholder image | **G1:** cloud `/health` 200 |
| 12:30–13:30 | **Wave 2:** runs/quota/idempotency, Tier 0 screens | **G2:** A02–A05 green locally |
| 13:30–14:00 | Deploy real image; run harness-based checks in cloud | **G3 (cut line 14:00):** A01–A11 green in cloud. If red, Tier 1/2 stops |
| 14:00–15:00 | A12 replay with a fresh agent session; evidence capture; Tier 1 shell (landing, login split) | **G4:** A12 passes |
| 15:00–15:40 | Tier 2 (flagged simulation) **only if G3/G4 green**; README, AIFE log | — |
| 15:40–16:00 | Freeze. Final deploy, final `verify.sh --full`, submission zip | **G5:** submission checklist |
| 16:00–17:00 | Checking: be ready to demo and answer panel questions | — |

## 3. Task board (IDs referenced by commits)

### Infra / Data (P1)
| ID | Task | Checks |
|---|---|---|
| I-01 | Verify/bootstrap Azure prerequisites, roles, SQL contained user | A01 |
| I-02 | Terraform: container + Container App, tfvars (dev/test) | A01 |
| I-03 | Dockerfile, ACR build, image tagging | A01 |
| I-04 | `deploy.sh`, `verify.sh`, `cleanup.sh` | A01, A12 |
| I-05 | Migrations 001–003 + `migrate.py`, `seed.py` | all |
| I-06 | Harness CLI: reset, suspend, set-plan, set-quota | A08, A10 |
| I-07 | `skills/text-tools/SKILL.md` | A12 |

### Backend / QA (P2)
| ID | Task | Checks |
|---|---|---|
| B-01 | FastAPI skeleton, config, error envelope, request ID, logging | — |
| B-02 | Auth: login, session, principal, tenant-override guard | A06, A07 |
| B-03 | Validation R1–R4 + fixtures + unit tests | A02, A03 |
| B-04 | Processor (pure) + unit tests | A04 |
| B-05 | Blob/SQL adapters | A04 |
| B-06 | `POST /runs`: entitlement, shape, accept txn, execute, persist | A04–A11 |
| B-07 | Replay logic (200/409/in-progress) | A09 |
| B-08 | `GET /runs`, `/runs/{id}/result`, `/tools`, `/subscription` | A04, A07, A10 |
| B-09 | Test hook (forced failure) | A11 |
| B-10 | Concurrency tests (threads/asyncio) | A08, A09 |
| Q-01 | E2E suite A01–A12 + evidence writer | all |
| Q-02 | Red-team script: cross-tenant, overrides, bool/str repeat | A05, A07 |

### Frontend / Planner (P3)
| ID | Task | Checks |
|---|---|---|
| F-01 | Tokens, fonts, base components (button, input, chip, quota meter, proof block, table) | — |
| F-02 | App shell + auth guard + API client (Idempotency-Key per submit) | — |
| F-03 | **Run tools** screen | FR-19 |
| F-04 | **History** screen + result viewer | FR-20 |
| F-05 | Login (split screen) | Tier 1 |
| F-06 | Landing (hero, how it works, pricing, FAQ, footer) | Tier 1 |
| F-07 | Error/empty/suspended/quota states | — |
| F-08 | Billing page + "Lathe Settle" modal | Tier 2 |
| P-01 | README, DECISIONS, AIFE log, submission checklist | — |

## 4. Implementation order inside `POST /runs` (B-06)

1. Pydantic/strict parse with size cap → shape errors (400)
2. Entitlement function (403s)
3. Idempotency header check (400)
4. Validation service → issues; if `process` and invalid → 400
5. `accept_run()` transaction (insert + reserve) with deadlock retry
6. Replay path on unique violation
7. `execute_run()`: Running already committed → processor → blob → `finish_run()`; wrap in try/except → `Failed`
8. Response mapping (201/200)

Write tests for each step **before** merging it.

## 5. Acceptance matrix (A01–A12)

| ID | How we prove it | Test / evidence file | Owner |
|---|---|---|---|
| A01 | `terraform validate`, `apply`, `curl /health`, second `plan -detailed-exitcode` = 0, `terraform state list` shows only the two resources | `evidence/A01/*` via `verify.sh` | P1 |
| A02 | validate valid fixture → 2/0/[] | `tests/e2e/test_a02.py` | P2 |
| A03 | validate invalid fixture → 2/4 + R1..R4 issues at rows 3–6 | `test_a03.py` | P2 |
| A04 | process valid → exact rows & summary; restart (`az containerapp revision restart`) then GET result | `test_a04.py` + restart log | P2/P1 |
| A05 | invalid process, wrong shape, 11 rows → 400; run count + `DailyUsage` unchanged | `test_a05.py` | P2 |
| A06 | no token 401 on each protected route; Viewer submit 403; Basic process 403; no debit | `test_a06.py` | P2 |
| A07 | Tenant B lists none of A; GET A's run → 404; body/query/header override → 400 | `test_a07.py` | P2 |
| A08 | Basic: 3 OK, 4th 429; set 1 slot left, fire 2 concurrent → exactly 1 accepted | `test_a08.py` (harness) | P2/P1 |
| A09 | At exhausted quota: same key → 200 same run, no debit; changed input → 409; 2 simultaneous identical keys → ≤ 1 run | `test_a09.py` | P2 |
| A10 | Harness suspends tenant → POST 403, no debit; GET list/result 200 | `test_a10.py` | P2/P1 |
| A11 | Hook forces failure → run Failed, error recorded, 1 slot used; replay returns failure without re-exec (log shows no second execution) | `test_a11.py` | P2 |
| A12 | Fresh agent session follows `skills/text-tools/SKILL.md` and reproduces success, invalid, forced-failure | `evidence/A12/transcript-redacted.md` | P1 + P3 |

## 6. Test strategy

- **Unit:** validation (every rule, bool/str traps, trimming, case-sensitive IDs, later-duplicate-only), processor (spaces, repeat, mode), fingerprint canonicalisation.
- **Integration:** SQL accept txn, quota boundary, replay decision table.
- **Concurrency:** 20 parallel requests at 1 slot → 1 accepted; 10 parallel identical keys → 1 run row.
- **E2E (cloud):** A01–A12 via the real URL.
- **Property-ish:** random batches never crash the validator; counts invariant `valid + invalid == rows`.
- Run `pytest -x` before every push. Flaky test = bug; fix, don't retry.

## 7. Demo script (panel order is the same for all teams; rehearse)

1. Landing → Login as Tenant A Operator (Pro). Show plan chip + quota meter.
2. Run tools: submit **valid** fixture as *validate* → 2 valid. Submit **invalid** → 4 issues with rule IDs.
3. Switch to *process* with the valid fixture → proof block: `HELLO HELLO` (11), `world` (5), 16 chars.
4. History → open the run → result persisted. Mention the restart evidence.
5. **Replay:** repeat with same key → same run (200); change one character with same key → 409.
6. **Quota:** sign in as Tenant B (Basic) → three validates, fourth → 429; Viewer sees disabled submit with explanation; Basic *process* → 403.
7. **Tenant isolation:** curl tenant B listing; fetch A's run ID → 404; send `tenant_id` in body → 400.
8. Harness suspend → submit blocked, history readable.
9. Terraform: show `plan` → no changes; show the two resources only.
10. (If green) Lathe Settle: upgrade B to Pro with `BENCH-CLEAR`, quota continuity explained.

Prepare crisp answers for the likely panel questions:
- *How do you guarantee quota under concurrency?* Conditional update in one transaction; lock on the usage row; tests.
- *How is replay ordered before quota?* Unique index insert comes first; duplicates short-circuit.
- *Where does tenant come from?* Verified session only; override guard; SQL scoping; uniform 404.
- *What counts as a debit?* Every accepted unique run, including failures; rejected requests roll back.

## 8. Cut line and priorities

1. Tier 0 correctness (A01–A12)
2. Evidence + SKILL.md replay
3. Tier 1 shell
4. Tier 2 simulation

At **14:00** if any Tier 0 check is red → freeze Tier 1/2 and fix.
Quality bar over feature count: **extra features earn no marks**.

## 9. Submission checklist (by 16:00)

- [ ] `README.md` (what, how to run, how to deploy, design decisions, known limits)
- [ ] `infra/` (two resources, two tfvars)
- [ ] `scripts/` (deploy, verify, cleanup)
- [ ] App code (`app/`, `web/`)
- [ ] `migrations/` incl. Runs and DailyUsage
- [ ] `tests/` (unit, integration, concurrency, e2e)
- [ ] `skills/text-tools/SKILL.md`
- [ ] `evidence/` (A01–A12 redacted + `AIFE_LOG.md`)
- [ ] Secrets scan clean; `.env`/state files not included
- [ ] Final deploy hash recorded; `/health` 200 on dev sandbox

## 10. AIFE log template (`evidence/AIFE_LOG.md`)

| Time | Task ID | AI assistance (what it generated) | Human correction | Verification |
|---|---|---|---|---|
| 11:42 | B-03 | Validation module + tests | Fixed bool-as-int trap | `pytest tests/unit` + A03 |

## 11. Known limits to state honestly
- No crash recovery: a process crash mid-run leaves `Running` (out of scope).
- Login throttle is per-replica in memory.
- Tenants/users/subscription seed tables are ours because the starter did not arrive.
- Tier 2 simulation uses a sandbox "voucher" concept and moves no money.
