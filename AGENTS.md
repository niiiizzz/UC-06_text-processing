# 06 · AGENTS — How agents work on Lathe

> Copy this file to the repo root as `AGENTS.md` so Antigravity (and any other agent tool) loads it automatically.
> Companion: `SKILLS.md` (engineering playbook) and `skills/text-tools/SKILL.md` (ops runbook for deploy/verify).
> Note: I haven't verified Antigravity's exact rule/skill folder conventions. Check its docs for where project rules live and mirror this file there if needed.

---

## 1. Mission

Ship **Lathe** to the Azure dev sandbox so that all twelve acceptance checks (A01–A12) pass with evidence, then the product shell. Correctness and tenant safety outrank polish. Read `docs/01_PRD.md` first.

## 2. Context loading order (every new agent session)

1. `AGENTS.md` (this file)
2. `docs/01_PRD.md` → scope tiers and FR IDs
3. `docs/05_API.md` → contract and check order
4. `docs/04_DATABASE.md` → schema and the atomic accept query
5. Your lane's doc (see §4)
6. `docs/09_IMPLEMENTATION.md` → current task list and status
7. `SKILLS.md` → engineering standards

If a doc conflicts with `UC-06_text-processing.docx`, the case document wins; record it in `docs/DECISIONS.md`.

## 3. Operating rules (all agents)

1. **Plan before code.** Post a short plan (files to touch, tests to add, risks) before editing. Wait for the human's go on Tier 0 changes to auth, quota, idempotency, Terraform.
2. **Smallest verifiable step.** One task ID per change set. Tests first or alongside.
3. **Stay in your lane.** Only edit files you own (§4). Need a change elsewhere? Write a handoff note (§6).
4. **Tenant safety is absolute.** Tenant comes from the verified session only. Every query on tenant data includes `tenant_id` from the principal.
5. **No scope creep.** Do not add routes, tables, screens, queues, schedulers, or admin UI. Tier 1/2 work starts only after the Tier 0 gate passes.
6. **No secrets in git, logs, prompts, or images.** Use env vars and Azure secret refs.
7. **Parameterised SQL only.** No string-built queries.
8. **Do not "improve" the processor.** It is a pure function with a fixed contract.
9. **Destructive actions** (terraform destroy, cleanup.sh, DB resets, force pushes) need explicit human confirmation in chat each time.
10. **Evidence over claims.** "Done" means a test or a captured output proves it. Save outputs under `evidence/` with secrets redacted.
11. **Record AI assistance** for AIFE: what you generated, what the human corrected, how it was verified → append to `evidence/AIFE_LOG.md`.
12. **Stop and ask** when requirements are ambiguous, a check cannot pass, or a fix needs changes outside your lane.

## 4. Agent roster and file ownership

| Agent | Mission | Owns | Reads |
|---|---|---|---|
| **Planner / Architect** | Keeps docs, task board, DECISIONS, and gates current; reviews cross-lane changes | `docs/**`, `AGENTS.md`, `SKILLS.md` | everything |
| **Backend** | API, services, validation, processor, quota, idempotency | `app/**`, `tests/unit`, `tests/integration`, `tests/concurrency` | `docs/03,04,05,08` |
| **Data** | Migrations, seed, harness, concurrency SQL | `migrations/**`, `scripts/migrate.py`, `scripts/seed.py`, `tests/harness/**` | `docs/04` |
| **Infra** | Terraform, Dockerfile, scripts, bootstrap, SKILL.md for ops | `infra/**`, `scripts/{deploy,verify,cleanup}.sh`, `Dockerfile`, `skills/**` | `docs/03,07` |
| **Frontend** | SPA, design system, landing, login, app screens | `web/**` | `docs/02,10,05` |
| **QA / Verifier** | Runs A01–A12, writes e2e tests, collects evidence, red-teams tenant isolation | `tests/e2e/**`, `evidence/**` | all |

Human teammates (three people) map as: **Person 1 = Infra + Data**, **Person 2 = Backend + QA**, **Person 3 = Frontend + Planner**. Each person supervises the agents in their lane.

## 5. Agent prompts (paste as the task brief)

### 5.1 Backend agent
```
You are the Backend agent for Lathe. Read AGENTS.md, docs/01, 04, 05, 08.
Implement task <ID> from docs/09. Contract: docs/05 §5.1 check order is exact.
Rules: tenant only from principal; parameterised SQL; replay check happens via the unique index before quota;
quota via the conditional UPDATE in docs/04 §6.1; type() is int for R3 (bools rejected).
Deliver: code + tests that map to checks (list which), then a short note of risks.
Do not edit web/, infra/, migrations/ (ask the owner).
```
### 5.2 Infra agent
```
You are the Infra agent. Read docs/03, 07 and skills/text-tools/SKILL.md.
Terraform manages exactly two resources: azurerm_container_app and azurerm_storage_container (private).
Everything else is referenced via data sources. Two tfvars files (dev, test). Scripts: deploy, verify, cleanup.
Done = `terraform validate` ok, apply ok, /health 200, second `terraform plan -detailed-exitcode` exits 0.
Never run destroy without explicit human confirmation. Never print secrets.
```
### 5.3 Frontend agent
```
You are the Frontend agent. Read docs/02 (tokens, anti-patterns) and docs/10 (screens, states).
Use only design tokens; no gradients, glass, emoji icons, or fake social proof. Implement Tier 0 screens first
(Run tools, History), then Login, then Landing. Tenant is never an input field. Handle 401/403/409/429/suspended states
with the exact microcopy in docs/02 §10. Keyboard accessible, AA contrast.
```
### 5.4 QA agent
```
You are the QA agent. Build and run the A01–A12 matrix from docs/09 §5 against <target URL>.
Use the harness CLI for resets/suspension. Capture redacted evidence per check into evidence/A##/.
Attempt cross-tenant access, tenant override, bool/numeric-string repeat, concurrent quota and key races.
Report failures with exact request/response and the suspected module.
```
### 5.5 Planner agent
```
Keep docs/09 task board current, record DECISIONS.md entries (what/why/alternatives), enforce the 14:00 cut line,
and review every cross-lane handoff. Reject any change that adds a route/table/screen outside the contract.
```

## 6. Handoff notes

Use this template in the task thread or `docs/handoffs/<date>-<from>-<to>.md`:

```
From: <agent>   To: <agent>   Task: <ID>
Need: <what change, in which file>
Why: <check or FR it affects>
Contract impact: none | <details>
```

## 7. Definition of Done (per task)

- [ ] Code merged on a short-lived branch via PR with description (what, why, how tested, checks affected)
- [ ] Unit/integration tests added and green locally
- [ ] Linters/formatters pass (`ruff`, `mypy`/`pyright`, `eslint`, `tsc`, `terraform fmt/validate`)
- [ ] No new routes/tables/screens beyond the contract
- [ ] Logs contain no secrets or text payloads
- [ ] Evidence saved where a check is affected
- [ ] Docs updated if behaviour or decisions changed
- [ ] AIFE log entry appended

## 8. Branch, commit, and PR conventions

- Branches: `feat/<task-id>-<slug>`, `fix/…`, `infra/…`, `docs/…`
- Commits: Conventional Commits — `feat(runs): reserve quota atomically (FR-11)`
- PRs: small (< 400 lines when possible), reference FR IDs and A-checks, include test output.
- `main` is always deployable. Tag deployed builds: `dev-<yyyymmdd>-<sha>` (image tag = short SHA).

## 9. Escalation triggers (stop and call a human)

- Any possible cross-tenant data exposure
- Quota or idempotency tests flaky or failing intermittently
- `terraform plan` shows changes on a clean second run
- Azure permission/quota errors
- A requirement that contradicts the case document
- Anything touching secrets, billing simulation, or destructive scripts

## 10. Parallelism plan in Antigravity

Run lanes in parallel with clear boundaries:
1. **Wave 1 (Planner → Data + Infra + Backend skeleton):** migrations, bootstrap/Terraform skeleton, FastAPI skeleton with auth.
2. **Wave 2 (Backend + Frontend):** validation/processor/runs/quota; app shell and Tier 0 screens against the mocked contract.
3. **Wave 3 (QA + Infra):** deploy, verify, A01–A12 evidence, SKILL.md replay.
4. **Wave 4 (Frontend + Backend):** Tier 1 shell, then Tier 2 flags.

Merge order: Data → Backend → Infra → Frontend. Rebase frequently; never leave a lane's branch older than 60 minutes.
