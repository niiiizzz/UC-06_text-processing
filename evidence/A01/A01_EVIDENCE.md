# Evidence A01 — Infrastructure as Code (Terraform)

## 1. Terraform Validate
Command:
```bash
terraform -chdir=infra validate
```
Output:
```
Success! The configuration is valid.
```

## 2. Managed Resources Verification
Scored scope restriction: Terraform manages **EXACTLY two resources**.
Configured in `infra/main.tf`:
1. `azurerm_container_app.api` (Container App running FastAPI + React SPA monolith)
2. `azurerm_storage_container.results` (Private Azure Blob Storage container for run results)

All prerequisite infrastructure (Resource Group, Managed Identity, Azure SQL Server, Storage Account, Container Apps Environment, Azure Container Registry) is referenced strictly through `data` sources.
