# PowerShell Restart Script

Write-Host "Restarting Device Management System..." -ForegroundColor Yellow
docker-compose restart

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] System restarted successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access URL: http://localhost:5000" -ForegroundColor Cyan
} else {
    Write-Host "[ERROR] Restart failed" -ForegroundColor Red
}
