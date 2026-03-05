# PowerShell Logs Script

Write-Host "Viewing system logs (Press Ctrl+C to exit):" -ForegroundColor Cyan
Write-Host ""
docker-compose logs -f
