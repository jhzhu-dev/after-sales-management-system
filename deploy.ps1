# PowerShell Deploy Script
# Device Management System Docker Deployment

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Device Management System - Docker Deploy" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    $dockerVersion = docker --version
    Write-Host "[OK] Docker installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker not installed, please install Docker Desktop" -ForegroundColor Red
    Write-Host "Download: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
    Write-Host "[OK] Docker service is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker service not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please follow these steps:" -ForegroundColor Yellow
    Write-Host "1. Open Docker Desktop application" -ForegroundColor White
    Write-Host "2. Wait until Docker Desktop status shows 'Engine running'" -ForegroundColor White
    Write-Host "3. Run this script again: .\deploy.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "If Docker Desktop is already open, try:" -ForegroundColor Yellow
    Write-Host "- Restart Docker Desktop" -ForegroundColor White
    Write-Host "- Check Settings -> General -> Use WSL 2 based engine is enabled" -ForegroundColor White
    exit 1
}

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "[WARN] .env file not found, creating from template..." -ForegroundColor Yellow
    Copy-Item ".env.docker" ".env"
    Write-Host "[OK] .env file created, please check the configuration" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tip: To use OSS storage, edit .env file with real credentials" -ForegroundColor Yellow
    Write-Host ""
}

# Stop old containers
Write-Host ""
Write-Host "[STEP] Stopping old containers..." -ForegroundColor Yellow
docker-compose down

# Build images
Write-Host ""
Write-Host "[STEP] Building Docker images (this may take several minutes)..." -ForegroundColor Yellow
docker-compose build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Image build failed" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Image build completed" -ForegroundColor Green

# Start services
Write-Host ""
Write-Host "[STEP] Starting services..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Service start failed" -ForegroundColor Red
    exit 1
}

# Wait for services to start
Write-Host ""
Write-Host "[STEP] Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check service status
Write-Host ""
Write-Host "[INFO] Service Status:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "[SUCCESS] Deployment completed!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  Local: http://localhost:5000" -ForegroundColor White
Write-Host "  LAN: http://<YOUR_IP>:5000" -ForegroundColor White
Write-Host ""
Write-Host "Common Commands:" -ForegroundColor Cyan
Write-Host "  View logs: .\logs.ps1" -ForegroundColor White
Write-Host "  Stop service: .\stop.ps1" -ForegroundColor White
Write-Host "  Restart service: docker-compose restart" -ForegroundColor White
Write-Host ""

# Ask if user wants to view logs
$viewLogs = Read-Host "View real-time logs? (y/n)"
if ($viewLogs -eq 'y' -or $viewLogs -eq 'Y') {
    Write-Host ""
    Write-Host "[INFO] Viewing logs (Press Ctrl+C to exit):" -ForegroundColor Cyan
    docker-compose logs -f
}
