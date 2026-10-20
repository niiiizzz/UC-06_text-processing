# 07 · SETUP — Lathe

Covers: local environment, Azure prerequisites (bootstrap), Terraform, Docker, scripts, and troubleshooting.

---

## 1. Tooling

| Tool | Version | Check |
|---|---|---|
| Python | 3.12 | `python --version` |
| Node.js | 20 LTS | `node -v` |
| Docker Desktop | recent | `docker version` |
| Azure CLI | 2.60+ | `az version` |
| Terraform | 1.7+ | `terraform version` |
| ODBC Driver 18 for SQL Server | 18 | needed by `pyodbc` |
| `jq`, `curl` | any | used by scripts |
| Git | any | |

Windows users: run scripts in **WSL2** or Git Bash. `deploy.sh` and friends are bash.

## 2. Local development

### 2.1 Services (`docker-compose.yml`)
```yaml
services:
  sql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "Local_Dev_Only_1!"
    ports: ["1433:1433"]
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    ports: ["10000:10000"]
```
`docker compose up -d` then create the database: `sqlcmd -S localhost -U sa -P 'Local_Dev_Only_1!' -Q "CREATE DATABASE lathe"`.

### 2.2 Environment file `.env` (never committed; `.env.example` is)
```
APP_ENV=dev
SQL_AUTH_MODE=sql
SQL_SERVER=localhost
SQL_DATABASE=lathe
SQL_USER=sa
SQL_PASSWORD=Local_Dev_Only_1!
BLOB_ACCOUNT_URL=http://127.0.0.1:10000/devstoreaccount1
BLOB_CONTAINER=results-dev
BLOB_AUTH_MODE=azurite
SESSION_SECRET=<openssl rand -hex 32>
SESSION_TTL_MINUTES=480
SEED_PASSWORD=<choose a demo password>
ENABLE_TEST_HOOKS=true
FEATURE_BILLING_SIM=false
FEATURE_SIGNUP_SIM=false
```

### 2.3 Run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/migrate.py            # applies migrations/*.sql in order
python scripts/seed.py               # tenants, users (argon2id), from SEED_PASSWORD
uvicorn app.main:app --reload --port 8000

cd web && npm ci && npm run dev      # Vite on :5173, proxies /api → :8000
```
In production the SPA is built to `web/dist` and copied into the image under `app/static`. The API serves it.

### 2.4 Tests
```bash
pytest tests/unit -q
pytest tests/integration -q          # needs the local SQL container
pytest tests/concurrency -q          # threads hitting /runs
npm --prefix web run test
```

## 3. Azure prerequisites

Organisers are supposed to provide these. If they don't, create them with `infra/bootstrap/` (one-time, separate Terraform state, not part of the two scored resources).

| Prerequisite | Name (example) |
|---|---|
| Resource group | `rg-lathe-dev` |
| Log Analytics workspace | `log-lathe-dev` |
| Container Apps environment | `cae-lathe-dev` |
| Container Registry | `acrlathe<unique>` |
| Storage account | `stlathe<unique>` |
| Azure SQL server + database | `sql-lathe-<unique>` / `lathe` |
| User-assigned managed identity | `id-lathe-dev` |

### 3.1 Manual fallback (az CLI)
```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"
LOC=centralindia      # fallback regions if quota/SKU fails: southindia, southeastasia, eastasia
RG=rg-lathe-dev
az group create -n $RG -l $LOC
az monitor log-analytics workspace create -g $RG -n log-lathe-dev -l $LOC
az containerapp env create -g $RG -n cae-lathe-dev -l $LOC \
   --logs-workspace-id $(az monitor log-analytics workspace show -g $RG -n log-lathe-dev --query customerId -o tsv) \
   --logs-workspace-key $(az monitor log-analytics workspace get-shared-keys -g $RG -n log-lathe-dev --query primarySharedKey -o tsv)
az acr create -g $RG -n acrlathe$RANDOM -l $LOC --sku Basic
az storage account create -g $RG -n stlathe$RANDOM -l $LOC --sku Standard_LRS --allow-blob-public-access false
az identity create -g $RG -n id-lathe-dev
az sql server create -g $RG -n sql-lathe-$RANDOM -l $LOC --enable-ad-only-auth \
   --external-admin-principal-type User --external-admin-name "<your-entra-user>" --external-admin-sid "<object-id>"
az sql db create -g $RG -s <sql-server> -n lathe --service-objective Basic
```
(Entra-only SQL auth is the safest default. If the sandbox requires SQL auth, store the admin password in a Container App secret and note it in `docs/DECISIONS.md`.)

### 3.2 Role assignments
```bash
UAMI_ID=$(az identity show -g $RG -n id-lathe-dev --query principalId -o tsv)
az role assignment create --assignee-object-id $UAMI_ID --assignee-principal-type ServicePrincipal \
   --role AcrPull --scope $(az acr show -g $RG -n <acr> --query id -o tsv)
az role assignment create --assignee-object-id $UAMI_ID --assignee-principal-type ServicePrincipal \
   --role "Storage Blob Data Contributor" --scope $(az storage account show -g $RG -n <stacct> --query id -o tsv)
```
SQL (run as the Entra admin against database `lathe`):
```sql
CREATE USER [id-lathe-dev] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [id-lathe-dev];
ALTER ROLE db_datawriter ADD MEMBER [id-lathe-dev];
```
Also allow your client IP (for running migrations from your laptop) via the SQL server firewall, and enable "Allow Azure services" only if the sandbox demands it.

## 4. Terraform (scored resources only)

### 4.1 Layout
```
infra/
  versions.tf   variables.tf   main.tf   outputs.tf
  env/dev.tfvars   env/test.tfvars
```

### 4.2 `versions.tf`
```hcl
terraform {
  required_version = ">= 1.7"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
  # backend "azurerm" {}   # optional: remote state in a private container; pass via -backend-config
}
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}
```

### 4.3 `variables.tf` (essentials)
```hcl
variable "subscription_id"        { type = string }
variable "env"                    { type = string }              # dev | test
variable "resource_group_name"    { type = string }
variable "container_app_env_name" { type = string }
variable "acr_name"               { type = string }
variable "storage_account_name"   { type = string }
variable "identity_name"          { type = string }
variable "sql_server_fqdn"        { type = string }
variable "sql_database_name"      { type = string }
variable "image_tag"              { type = string }              # git short SHA
variable "session_secret"         { type = string, sensitive = true }
variable "enable_test_hooks"      { type = bool, default = false }
```

### 4.4 `main.tf` (the two scored resources + data sources)
```hcl
data "azurerm_resource_group" "rg"              { name = var.resource_group_name }
data "azurerm_container_app_environment" "cae"  { name = var.container_app_env_name, resource_group_name = var.resource_group_name }
data "azurerm_container_registry" "acr"         { name = var.acr_name, resource_group_name = var.resource_group_name }
data "azurerm_storage_account" "st"             { name = var.storage_account_name, resource_group_name = var.resource_group_name }
data "azurerm_user_assigned_identity" "id"      { name = var.identity_name, resource_group_name = var.resource_group_name }

# Scored resource 1/2 — private Blob container
resource "azurerm_storage_container" "results" {
  name                  = "results-${var.env}"
  storage_account_id    = data.azurerm_storage_account.st.id
  container_access_type = "private"
}

# Scored resource 2/2 — Container App
resource "azurerm_container_app" "api" {
  name                         = "lathe-${var.env}"
  resource_group_name          = data.azurerm_resource_group.rg.name
  container_app_environment_id = data.azurerm_container_app_environment.cae.id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [data.azurerm_user_assigned_identity.id.id]
  }
  registry {
    server   = data.azurerm_container_registry.acr.login_server
    identity = data.azurerm_user_assigned_identity.id.id
  }
  secret {
    name  = "session-secret"
    value = var.session_secret
  }
  ingress {
    external_enabled = true
    target_port      = 8000
    traffic_weight { latest_revision = true, percentage = 100 }
  }
  template {
    min_replicas = 1
    max_replicas = 2
    container {
      name   = "api"
      image  = "${data.azurerm_container_registry.acr.login_server}/lathe:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"
      env { name = "APP_ENV"            value = var.env }
      env { name = "SQL_AUTH_MODE"      value = "msi" }
      env { name = "SQL_SERVER"         value = var.sql_server_fqdn }
      env { name = "SQL_DATABASE"       value = var.sql_database_name }
      env { name = "AZURE_CLIENT_ID"    value = data.azurerm_user_assigned_identity.id.client_id }
      env { name = "BLOB_ACCOUNT_URL"   value = data.azurerm_storage_account.st.primary_blob_endpoint }
      env { name = "BLOB_CONTAINER"     value = azurerm_storage_container.results.name }
      env { name = "ENABLE_TEST_HOOKS"  value = tostring(var.enable_test_hooks) }
      env { name = "SESSION_SECRET"     secret_name = "session-secret" }
      liveness_probe  { transport = "HTTP", path = "/health", port = 8000 }
      readiness_probe { transport = "HTTP", path = "/health", port = 8000 }
    }
  }
}
```
Provider/attribute names change between azurerm versions (e.g. `storage_account_id` vs `storage_account_name`). Run `terraform validate` early and adjust to the installed provider version rather than trusting this snippet verbatim.

### 4.5 `env/dev.tfvars`
```hcl
env                    = "dev"
resource_group_name    = "rg-lathe-dev"
container_app_env_name = "cae-lathe-dev"
acr_name               = "acrlathexxxx"
storage_account_name   = "stlathexxxx"
identity_name          = "id-lathe-dev"
sql_server_fqdn        = "sql-lathe-xxxx.database.windows.net"
sql_database_name      = "lathe"
enable_test_hooks      = true      # dev sandbox only, for A11
```
`env/test.tfvars` mirrors it with `env = "test"` and `enable_test_hooks = true`. **Teams deploy only the dev sandbox.** Secrets (`subscription_id`, `session_secret`, `image_tag`) come from `TF_VAR_*` environment variables, never committed.

## 5. Dockerfile (multi-stage)

```dockerfile
FROM node:20-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl gnupg unixodbc \
 && curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/ms.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/ms.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql.list \
 && apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
COPY migrations/ migrations/
COPY scripts/migrate.py scripts/migrate.py
COPY --from=web /web/dist app/static
ARG GIT_SHA=dev
ENV APP_VERSION=$GIT_SHA
RUN useradd -r -u 10001 lathe && chown -R lathe /srv
USER lathe
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
Build/push: `az acr build -r <acr> -t lathe:$(git rev-parse --short HEAD) --build-arg GIT_SHA=$(git rev-parse --short HEAD) .`

## 6. Scripts (contract; exact flags matter because the SKILL.md calls them)

### 6.1 `scripts/deploy.sh`
Usage: `scripts/deploy.sh [--env dev] [--image-tag <tag>] [--auto-approve]`
Steps:
1. Preflight: `az account show`, `terraform version`, required `TF_VAR_*` present, `env/<env>.tfvars` exists.
2. If no `--image-tag`: build and push with `az acr build`, tag = short SHA.
3. `terraform -chdir=infra init -input=false`
4. `terraform -chdir=infra validate`
5. `terraform -chdir=infra plan -var-file=env/<env>.tfvars -var image_tag=<tag> -out=tfplan`
6. `terraform -chdir=infra apply tfplan` (prompt unless `--auto-approve`)
7. Run migrations: `python scripts/migrate.py` against the cloud SQL (needs firewall rule or run in CI).
8. Print FQDN, image tag, and "previous image tag" (read from the prior revision) for rollback.

Rollback: `scripts/deploy.sh --image-tag <previous>` (no rebuild).

### 6.2 `scripts/verify.sh`
Usage: `scripts/verify.sh [--env dev] [--full]`
1. `curl -fsS https://<fqdn>/health` → must be 200 with `{"status":"ok"}`.
2. `terraform plan -detailed-exitcode` → exit code **0** means no changes (A01). Exit 2 = drift → fail.
3. Confirm the plan/state contain only the two assigned resources (`terraform state list` filtered).
4. Fixture smoke: login as Tenant A Operator, `validate` valid fixture → 2/0; `validate` invalid fixture → 2/4; `process` valid → exact rows/summary.
5. `--full`: invokes `pytest tests/e2e -k "A01 or A02 … A11"` and writes redacted output into `evidence/`.

### 6.3 `scripts/cleanup.sh`
Usage: `scripts/cleanup.sh [--env dev] --confirm <env>`
- Refuses to run without `--confirm <env>` matching `--env`.
- Prints exactly what it will destroy (the two scored resources) and asks the human to type the resource group name.
- `terraform destroy -target=azurerm_container_app.api -target=azurerm_storage_container.results -var-file=env/<env>.tfvars`
- Never touches organiser-owned resources (RG, ACR, SQL, storage account, identity, CAE).

All scripts: `set -euo pipefail`, never `echo` secrets, exit non-zero with a clear message on any failed step.

## 7. Evidence folder
```
evidence/
  A01/ terraform-validate.txt  apply.txt  health.txt  plan-second-run.txt
  A02/ … A12/
  AIFE_LOG.md
```
Redact: tokens, cookies, passwords, subscription IDs, emails if not synthetic.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `pyodbc` can't find driver | ODBC 18 missing | Install msodbcsql18; in Docker use the image above |
| Container App stuck "Provisioning" | Image pull denied | Check UAMI has `AcrPull`; confirm `registry.identity` set |
| 500 `Login failed for user` | SQL contained user missing | Create `CREATE USER [<uami>] FROM EXTERNAL PROVIDER` |
| `AuthorizationPermissionMismatch` on blob | Missing `Storage Blob Data Contributor` | Assign on the storage account/container |
| Second `plan` shows changes | Provider-computed attribute drift | `terraform plan` output → add `lifecycle { ignore_changes = [...] }` for that attribute only, document why |
| `Cannot open server … from client IP` | SQL firewall | Add your IP rule |
| Region quota/SKU error | Region capacity | Retry in `southindia` or `southeastasia` |
| 429 immediately in tests | Previous runs not reset | Run harness reset |
| Forced failure test does nothing | `ENABLE_TEST_HOOKS` false | Set `enable_test_hooks = true` in dev.tfvars and redeploy |
