# PowerShell Stop Script

Write-Host "Stopping Device Management System..." -ForegroundColor Yellow
docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] System stopped successfully" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Stop failed" -ForegroundColor Red
}
