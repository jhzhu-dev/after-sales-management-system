# PowerShell System Status Check Script

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Device Management System - Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node processes
Write-Host "[1/5] Checking Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  OK - Found $($nodeProcesses.Count) Node process(es)" -ForegroundColor Green
} else {
    Write-Host "  FAIL - No Node processes found" -ForegroundColor Red
}
Write-Host ""

# 2. Check port 5000
Write-Host "[2/5] Checking port 5000..." -ForegroundColor Yellow
try {
    $tcpConnection = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction Stop
    Write-Host "  OK - Port 5000 is listening (PID: $($tcpConnection.OwningProcess))" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Port 5000 is not listening" -ForegroundColor Red
}
Write-Host ""

# 3. Test HTTP connection
Write-Host "[3/5] Testing HTTP connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  OK - HTTP connection successful (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - HTTP connection failed" -ForegroundColor Red
}
Write-Host ""

# 4. Test API endpoints
Write-Host "[4/5] Testing API endpoints..." -ForegroundColor Yellow
$successCount = 0
$apis = @(
    @{Name="Devices"; Url="/api/devices?page=1&limit=5"},
    @{Name="Issues"; Url="/api/issues?page=1&limit=5"},
    @{Name="Product Lines"; Url="/api/product-lines"},
    @{Name="Customers"; Url="/api/customers"}
)

foreach ($api in $apis) {
    try {
        $url = "http://localhost:5000$($api.Url)"
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "  OK - $($api.Name) ($($resp.StatusCode))" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "  FAIL - $($api.Name)" -ForegroundColor Red
    }
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($successCount -eq $apis.Count -and $nodeProcesses) {
    Write-Host "  System Status: RUNNING" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Access URL: http://localhost:5000" -ForegroundColor Cyan
} elseif ($successCount -gt 0) {
    Write-Host "  System Status: PARTIAL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Suggestion: Run .\restart.ps1" -ForegroundColor Yellow
} else {
    Write-Host "  System Status: OFFLINE" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Suggestion: Run npm start or .\restart.ps1" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
