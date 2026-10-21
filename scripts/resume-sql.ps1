# Resume Azure SQL Serverless for active use (60-min auto-pause after idle)
$AZ = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
Write-Host "Setting SQL auto-pause back to 60 minutes..." -ForegroundColor Yellow
cmd /c "$AZ" sql db update --resource-group rg-textforge-dev --server sql-textforge-dev --name textforge --auto-pause-delay 60 --output none
Write-Host "SQL DB active mode restored (auto-pause: 60min idle)." -ForegroundColor Green
