# =============================================================================
# TextForge Full Azure Deployment Script
# Provisions: Azure SQL Serverless + builds Docker image + deploys to Azure
# Student Account safe — Serverless DB auto-pauses when idle
# =============================================================================

$AZ            = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$RG            = "rg-textforge-dev"
$LOCATION      = "centralindia"
$ACR           = "acrtextforge8291"
$CONTAINER_APP = "textforge-dev"
$SQL_SERVER    = "sql-textforge-dev"
$SQL_DB        = "textforge"
$IMAGE_TAG     = "latest"
$IMAGE_NAME    = "textforge"
$SQL_ADMIN_USER = "textforgeadmin"
$SQL_ADMIN_PASS = "TF@Hack2026!"
$IDENTITY      = "id-textforge-dev"

Write-Host "
======================================================"
Write-Host "  TextForge Azure Deployment"
Write-Host "======================================================
"

# Step 1: Create SQL Serverless
Write-Host "[1/6] Creating Azure SQL Serverless..." -ForegroundColor Yellow
$sqlExists = (cmd /c "$AZ" sql server show --name $SQL_SERVER --resource-group $RG --query name -o tsv 2>&1)
if ($sqlExists -match $SQL_SERVER) {
    Write-Host "  SQL Server already exists" -ForegroundColor Green
} else {
    cmd /c "$AZ" sql server create --name $SQL_SERVER --resource-group $RG --location $LOCATION --admin-user $SQL_ADMIN_USER --admin-password $SQL_ADMIN_PASS --output none
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: SQL server failed" -ForegroundColor Red; exit 1 }
    Write-Host "  SQL server created" -ForegroundColor Green
}

cmd /c "$AZ" sql server firewall-rule create --resource-group $RG --server $SQL_SERVER --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 --output none 2>&1 | Out-Null

$dbExists = (cmd /c "$AZ" sql db show --name $SQL_DB --server $SQL_SERVER --resource-group $RG --query name -o tsv 2>&1)
if ($dbExists -match $SQL_DB) {
    Write-Host "  DB already exists" -ForegroundColor Green
} else {
    Write-Host "  Creating Serverless DB (auto-pause: 60min)..."
    cmd /c "$AZ" sql db create --resource-group $RG --server $SQL_SERVER --name $SQL_DB --edition GeneralPurpose --family Gen5 --compute-model Serverless --auto-pause-delay 60 --min-capacity 0.5 --capacity 4 --backup-storage-redundancy Local --output none
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: DB creation failed" -ForegroundColor Red; exit 1 }
    Write-Host "  DB created (Serverless, auto-pause 60min)" -ForegroundColor Green
}
$SQL_FQDN = (cmd /c "$AZ" sql server show --name $SQL_SERVER --resource-group $RG --query fullyQualifiedDomainName -o tsv 2>&1).Trim()
Write-Host "  SQL FQDN: $SQL_FQDN"

# Step 2: Grant MSI access to SQL
Write-Host "
[2/6] Granting Managed Identity SQL access..." -ForegroundColor Yellow
$IDENTITY_PRINCIPAL = (cmd /c "$AZ" identity show --name $IDENTITY --resource-group $RG --query principalId -o tsv 2>&1).Trim()
cmd /c "$AZ" sql server ad-admin create --resource-group $RG --server-name $SQL_SERVER --display-name $IDENTITY --object-id $IDENTITY_PRINCIPAL --output none 2>&1 | Out-Null
Write-Host "  AAD admin set" -ForegroundColor Green

# Step 3: Docker Build
Write-Host "
[3/6] Building Docker image..." -ForegroundColor Yellow
$ACR_SERVER = (cmd /c "$AZ" acr show --name $ACR --resource-group $RG --query loginServer -o tsv 2>&1).Trim()
cmd /c "$AZ" acr login --name $ACR --output none 2>&1
$FULL_IMAGE = "${ACR_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"
Set-Location "c:\Users\Noothan\Desktop\TextForge\UC-06_text-processing"
docker build -t $FULL_IMAGE .
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Docker build failed" -ForegroundColor Red; exit 1 }
Write-Host "  Built: $FULL_IMAGE" -ForegroundColor Green

# Step 4: Push to ACR
Write-Host "
[4/6] Pushing to ACR..." -ForegroundColor Yellow
docker push $FULL_IMAGE
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Push failed" -ForegroundColor Red; exit 1 }
Write-Host "  Pushed" -ForegroundColor Green

# Step 5: Update Container App
Write-Host "
[5/6] Updating Container App..." -ForegroundColor Yellow
cmd /c "$AZ" containerapp update --name $CONTAINER_APP --resource-group $RG --image $FULL_IMAGE --set-env-vars "SQL_AUTH_MODE=msi" "SQL_SERVER=$SQL_FQDN" "SQL_DATABASE=$SQL_DB" "APP_ENV=prod" --output none
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Container App update failed" -ForegroundColor Red; exit 1 }
Write-Host "  Container App updated" -ForegroundColor Green

# Step 6: Get URL
Write-Host "
[6/6] Getting app URL..." -ForegroundColor Yellow
$APP_URL = (cmd /c "$AZ" containerapp show --name $CONTAINER_APP --resource-group $RG --query "properties.configuration.ingress.fqdn" -o tsv 2>&1).Trim()

Write-Host "
======================================================"
Write-Host "  DONE! App live at: https://$APP_URL" -ForegroundColor Green
Write-Host "  SQL: $SQL_FQDN" -ForegroundColor Cyan
Write-Host "======================================================
"
