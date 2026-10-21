# Pause Azure SQL Serverless (stops compute billing; storage still billed ~pennies)
# Run this when you're done for the day at the hackathon
$AZ = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
Write-Host "Pausing SQL DB (stops compute billing)..." -ForegroundColor Yellow
cmd /c "$AZ" sql db update --resource-group rg-textforge-dev --server sql-textforge-dev --name textforge --auto-pause-delay 1 --output none
Write-Host "SQL DB set to auto-pause in 1 minute." -ForegroundColor Green
Write-Host "Note: DB resumes automatically on the next request (6-10 sec cold start)." -ForegroundColor Cyan
