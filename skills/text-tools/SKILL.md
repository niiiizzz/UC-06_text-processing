---
name: text-tools
description: Deploy, verify, troubleshoot, roll back, and clean up the Lathe text-processing SaaS (UC-06) on the Azure dev sandbox using the repo scripts. Use when asked to deploy Lathe, run the common acceptance checks A01-A12, reproduce the successful / invalid / forced-failure fixtures, investigate a failed run, roll back to a previous image, or clean up team-owned resources.
---

# text-tools — Lathe deploy and verify runbook

Follow this file literally. Do not improvise commands. If a step's expected result does not match, **stop** and report (see Stop conditions).

## 1. Trigger

Use this skill when the user asks to: deploy Lathe; verify the deployment; run or reproduce A01–A12; reproduce the valid / invalid / forced-failure fixtures; troubleshoot the forced failure; roll back; or clean up.

## 2. Required inputs

Ask the user for any that are missing. Never print their values back in full.

| Input | Example | Notes |
|---|---|---|
| `ENV` | `dev` | Only the assigned **dev** sandbox. Never deploy `test`. |
| `TF_VAR_subscription_id` | (secret) | Azure subscription |
| `TF_VAR_session_secret` | (secret) | 32+ random bytes |
| `SEED_PASSWORD` | (secret) | Sandbox demo password for seeded users |
| Azure login | `az login` done | Must have access to the team resource group |
| `BASE_URL` | from `deploy.sh` output | Container App FQDN |

## 3. Preflight (all must pass)

```bash
az account show --query "{sub:id,user:user.name}" -o json      # logged in, correct subscription
terraform version                                               # >= 1.7
docker version --format '{{.Server.Version}}'                   # or az acr build is available
test -f infra/env/${ENV}.tfvars && echo ok                      # env file present
test -n "$TF_VAR_subscription_id" && test -n "$TF_VAR_session_secret" && echo secrets-set
git rev-parse --short HEAD                                      # image tag source
```
Expected: each command succeeds; `ENV` equals `dev`.
Stop if: not logged in, wrong subscription, missing env file, or secrets unset.

## 4. Deploy

```bash
scripts/deploy.sh --env dev
```
Expected result:
- Terraform `validate` passes; `apply` creates/updates only `azurerm_container_app.api` and `azurerm_storage_container.results`.
- Migrations applied (`Runs`, `DailyUsage`, seed tables).
- Output prints `FQDN`, `image_tag`, and `previous_image_tag`. **Record all three.**

Stop if: apply targets or changes any resource other than the two above; migration errors; image push/pull errors.

## 5. Verify (smoke + A01)

```bash
scripts/verify.sh --env dev
```
Expected result (all must hold):
1. `GET /health` → `200` and `{"status":"ok", ...}`
2. `terraform plan -detailed-exitcode` → exit code `0` (no changes)
3. `terraform state list` shows only the two assigned resources
4. validate valid fixture → `valid_rows 2`, `invalid_rows 0`, `issues []`
5. validate invalid fixture → `valid_rows 2`, `invalid_rows 4`, one issue each for R1, R2, R3, R4
6. process valid fixture → rows `HELLO HELLO` (length 11) and `world` (length 5); summary `input_rows 2`, `output_characters 16`

Full acceptance run with evidence capture:
```bash
scripts/verify.sh --env dev --full
```
Expected: checks A01–A11 pass; redacted outputs written to `evidence/A01 … evidence/A11`.

Stop if: any check fails, plan exit code is `2` (drift) or `1` (error), or health is not 200.

## 6. Reproduce the three required scenarios (A12)

Use the harness (never the product API) to set state. Use an **active Pro Operator** (Tenant A) unless stated.

### 6.1 Successful run
```bash
python tests/harness/harness.py reset --env dev
BASE=$(terraform -chdir=infra output -raw fqdn)
TOKEN=$(curl -s https://$BASE/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"op.a@lathe.test\",\"password\":\"$SEED_PASSWORD\"}" | jq -r .token)
curl -s -i -X POST https://$BASE/runs -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: skill-ok-1" -H 'content-type: application/json' \
  -d @tests/fixtures/process_valid.json
```
Expected: `201`, `status: "Succeeded"`. Then fetch `GET /runs/{run_id}/result` → rows `HELLO HELLO` (11), `world` (5), `output_characters 16`.

### 6.2 Invalid batch
```bash
curl -s -X POST https://$BASE/runs -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: skill-invalid-validate" -H 'content-type: application/json' \
  -d @tests/fixtures/validate_invalid.json
```
Expected: validate → `201` run whose result has `valid_rows 2`, `invalid_rows 4`, issues R1..R4.
Then process the same invalid rows with a new key → `400`, and `GET /subscription` shows `used_today` unchanged by that request.

### 6.3 Forced failure (A11)
Requires `enable_test_hooks = true` in `infra/env/dev.tfvars` (already set for dev).
```bash
python tests/harness/harness.py reset --env dev
curl -s -i -X POST https://$BASE/runs -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: skill-fail-1" -H "X-Test-Force-Failure: true" \
  -H 'content-type: application/json' -d @tests/fixtures/process_valid.json
```
Expected: `201`, `status: "Failed"`; `GET /runs/{id}/result` returns `{run_id, status:"Failed", error:{code, message}}`; `GET /subscription` shows exactly **1** slot used.
Replay the same key (without needing the header) → `200`, same `run_id`, still `Failed`, **no** second execution (logs show a single `run.failed` for that run), no extra debit.

Save redacted outputs to `evidence/A12/` (mask tokens, passwords, subscription IDs).

## 7. Troubleshooting

| Symptom | Check | Fix |
|---|---|---|
| `/health` not 200 | `az containerapp logs show -n lathe-dev -g <rg> --tail 100` | Fix startup error (SQL identity, env vars); redeploy |
| Image pull failure | UAMI has `AcrPull`; `registry.identity` set | Assign role; re-apply |
| `Login failed for user` (SQL) | Contained user for the managed identity exists | Ask the human to create it (`CREATE USER … FROM EXTERNAL PROVIDER`) |
| Blob `AuthorizationPermissionMismatch` | `Storage Blob Data Contributor` on the identity | Ask the human to assign |
| Second plan shows changes | Read the diff | Report the exact attribute; do **not** add `ignore_changes` without human approval |
| Forced failure has no effect | `ENABLE_TEST_HOOKS` is `false` in the running revision | Set `enable_test_hooks = true` in dev.tfvars; redeploy |
| Unexpected 429 | Prior runs consumed quota | `python tests/harness/harness.py reset --env dev` |
| 403 on submit | Role, plan, or subscription status | `GET /subscription`; harness `set-plan` / `reactivate` if testing |

## 8. Rollback

Rollback is a deploy of the previous image. Do not rebuild.
```bash
scripts/deploy.sh --env dev --image-tag <previous_image_tag>
scripts/verify.sh --env dev
```
Expected: `terraform apply` changes only the Container App image tag; verify passes. Ask the human to confirm the tag before applying.

## 9. Cleanup (destructive: explicit confirmation required)

1. Show the human exactly what will be destroyed: `azurerm_container_app.api` and `azurerm_storage_container.results` for `dev`.
2. Ask: "Type the environment name (`dev`) to confirm destroying these team-owned resources." **Wait for the answer.**
3. Only after an exact confirmation:
```bash
scripts/cleanup.sh --env dev --confirm dev
```
Expected: only the two team-owned resources are destroyed. Organiser-owned resources (resource group, registry, SQL, storage account, identity, environment) are untouched.

Stop if: the human has not confirmed, the environment is not `dev`, or the plan includes any other resource.

## 10. Stop conditions (summary)

Stop and report with the exact command and output when:
- Preflight fails, or `ENV` is not `dev`
- Terraform would change anything other than the two assigned resources
- `/health` is not 200 after deploy, or plan is not a no-op on the second run
- Any acceptance check differs from the expected result
- A secret would be printed, committed, or placed in evidence unredacted
- A destructive action lacks explicit human confirmation
- Evidence suggests cross-tenant exposure or a permission bypass (treat as release-blocking)

## 11. Output format when reporting

Report: command run → exit code → key output lines → pass/fail against the expected result → path of the saved evidence file. Redact all secrets.
