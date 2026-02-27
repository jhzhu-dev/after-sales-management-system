# PowerShell Stop Script

Write-Host "停止设备管理系统..." -ForegroundColor Yellow

# 检查是否在Docker环境中
$dockerRunning = $false
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
    }
} catch {
    # Docker未运行
}

if ($dockerRunning) {
    Write-Host "[Docker模式] 停止容器..." -ForegroundColor Cyan
    docker-compose down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] 系统已停止" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] 停止失败" -ForegroundColor Red
    }
} else {
    Write-Host "[本地模式] 停止Node.js进程..." -ForegroundColor Cyan
    
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "发现 $($nodeProcesses.Count) 个Node进程" -ForegroundColor Yellow
        Stop-Process -Name node -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        
        $remainingProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
        if (-not $remainingProcesses) {
            Write-Host "[OK] 所有Node进程已停止" -ForegroundColor Green
        } else {
            Write-Host "[WARN] 部分进程可能仍在运行" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] 未发现运行中的Node进程" -ForegroundColor Cyan
    }
}
