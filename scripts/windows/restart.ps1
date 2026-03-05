# PowerShell Restart Script

Write-Host "重启设备管理系统..." -ForegroundColor Yellow

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
    Write-Host "[Docker模式] 重启容器..." -ForegroundColor Cyan
    docker-compose restart
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] 系统重启成功" -ForegroundColor Green
        Write-Host ""
        Write-Host "访问地址: http://localhost:5000" -ForegroundColor Cyan
    } else {
        Write-Host "[ERROR] 重启失败" -ForegroundColor Red
    }
} else {
    Write-Host "[本地模式] 重启Node.js进程..." -ForegroundColor Cyan
    
    # 停止所有Node进程
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "停止现有Node进程..." -ForegroundColor Yellow
        Stop-Process -Name node -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "Node进程已停止" -ForegroundColor Green
    }
    
    # 启动新进程
    Write-Host "启动服务器..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start" -WindowStyle Normal
    
    Start-Sleep -Seconds 3
    
    # 测试服务器
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "[OK] 系统重启成功" -ForegroundColor Green
        Write-Host ""
        Write-Host "访问地址: http://localhost:5000" -ForegroundColor Cyan
        Write-Host "服务器日志窗口已打开" -ForegroundColor Yellow
    } catch {
        Write-Host "[WARN] 服务正在启动中，请稍候..." -ForegroundColor Yellow
        Write-Host "访问地址: http://localhost:5000" -ForegroundColor Cyan
    }
}
