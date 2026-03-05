# ============================================================
# deploy-to-181.ps1  完整构建 + 部署到 192.168.0.181
#
# 流程：编译前端 → 构建 Docker 镜像 → 打标签 → 导出 →
#        传输到远端 → 加载镜像 → 重启服务 → 健康检查
#
# 使用方式：
#   .\deploy-to-181.ps1                   # 完整构建 + 部署
#   .\deploy-to-181.ps1 -SkipBuild        # 跳过 Docker 构建（直接用现有镜像）
# ============================================================
param(
    [string]$RemoteHost  = "192.168.0.181",
    [string]$RemoteUser  = "els",
    [string]$RemotePath  = "/home/els/manger",
    [string]$ImageName   = "device-manager-app",
    [string]$Version     = "latest",
    [switch]$SkipBuild   = $false          # 跳过镜像构建步骤
)

$TarFile    = "device-manager-app-$Version.tar"
$StartTime  = Get-Date
$TotalSteps = if ($SkipBuild) { 5 } else { 6 }
$Step       = 0

function Step-Header {
    param([string]$Title)
    $script:Step++
    Write-Host "`n[$script:Step/$TotalSteps] $Title" -ForegroundColor Yellow
}

function Step-OK   { Write-Host "  OK" -ForegroundColor Green }
function Step-Fail {
    param([string]$Msg)
    Write-Host "`n  [ERROR] $Msg" -ForegroundColor Red
    # 清理可能残留的tar包
    if (Test-Path $TarFile) { Remove-Item $TarFile -Force -ErrorAction SilentlyContinue }
    exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 售后登记系统  →  $RemoteHost"              -ForegroundColor Cyan
Write-Host " 开始时间: $(Get-Date -Format 'HH:mm:ss')"  -ForegroundColor Cyan
if ($SkipBuild) {
    Write-Host " 模式: 跳过构建，直接部署现有镜像"      -ForegroundColor DarkCyan
}
Write-Host "============================================" -ForegroundColor Cyan

# ── Step 1（可选）：构建 Docker 镜像 ────────────────────────
if (-not $SkipBuild) {
    Step-Header "构建 Docker 镜像 (device-manager-app:latest)"
    Write-Host "  构建上下文: $(Get-Location)" -ForegroundColor DarkGray

    # 实时输出构建日志，构建完成后再判断结果
    $buildOutput = @()
    $buildFailed = $false
    docker build -t manger-app:latest . 2>&1 | ForEach-Object {
        $line = "$_"
        $buildOutput += $line
        # 标记错误层
        if ($line -match '^#\d+ ERROR') {
            Write-Host "  $line" -ForegroundColor Red
            $buildFailed = $true
        } elseif ($line -match 'DONE|CACHED') {
            Write-Host "  $line" -ForegroundColor DarkGray
        } else {
            Write-Host "  $line"
        }
    }

    # docker build 通过退出码 0 表示成功（PowerShell 的 $LASTEXITCODE 在管道后不可靠，改用标志位）
    $imageExists = (docker images manger-app:latest --format "{{.ID}}" 2>$null) -ne ''
    if ($buildFailed -or -not $imageExists) {
        Step-Fail "Docker 构建失败，请检查上方日志"
    }
    Step-OK
}

# ── Step 2：打标签 ──────────────────────────────────────────
Step-Header "打镜像标签 $ImageName`:$Version"
docker tag manger-app:latest "$ImageName`:$Version"  2>&1 | Out-Null
docker tag manger-app:latest "$ImageName`:latest"    2>&1 | Out-Null
if ((docker images "$ImageName`:$Version" --format "{{.ID}}" 2>$null) -eq '') {
    Step-Fail "打标签失败，源镜像 manger-app:latest 不存在"
}
Step-OK

# ── Step 3：导出镜像为 tar ──────────────────────────────────
Step-Header "导出镜像  →  $TarFile"
docker save "$ImageName`:$Version" -o $TarFile 2>&1 | Out-Null
if (-not (Test-Path $TarFile)) { Step-Fail "镜像导出失败" }
$sizeMB = [math]::Round((Get-Item $TarFile).Length / 1MB, 1)
Write-Host "  大小: $sizeMB MB" -ForegroundColor DarkGray
Step-OK

# ── Step 4：传输文件到远端 ──────────────────────────────────
Step-Header "传输文件  →  ${RemoteUser}@${RemoteHost}:${RemotePath}"

Write-Host "  检查 SSH 连接..." -ForegroundColor DarkGray
ssh "${RemoteUser}@${RemoteHost}" "mkdir -p $RemotePath/ssl $RemotePath/uploads $RemotePath/backups" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Step-Fail "SSH 连接失败。请确认公钥已添加到远端 ~/.ssh/authorized_keys"
}

Write-Host "  传输镜像包 ($sizeMB MB)..." -ForegroundColor DarkGray
scp -C $TarFile "${RemoteUser}@${RemoteHost}:${RemotePath}/"
if ($LASTEXITCODE -ne 0) { Step-Fail "镜像传输失败" }

Write-Host "  传输 docker-compose.yml ..." -ForegroundColor DarkGray
scp docker-compose.linux.yml "${RemoteUser}@${RemoteHost}:${RemotePath}/docker-compose.yml"
if ($LASTEXITCODE -ne 0) { Step-Fail "docker-compose.yml 传输失败" }

if (Test-Path ".env") {
    Write-Host "  传输 .env ..." -ForegroundColor DarkGray
    scp .env "${RemoteUser}@${RemoteHost}:${RemotePath}/.env"
} elseif (Test-Path "env.example") {
    Write-Host "  [WARN] 未找到 .env，上传 env.example（请在远端手动修改）" -ForegroundColor DarkYellow
    scp env.example "${RemoteUser}@${RemoteHost}:${RemotePath}/.env"
}

Write-Host "  传输部署脚本 ..." -ForegroundColor DarkGray
scp scripts/remote-deploy.sh "${RemoteUser}@${RemoteHost}:${RemotePath}/remote-deploy.sh"
if ($LASTEXITCODE -ne 0) { Step-Fail "部署脚本传输失败" }

Step-OK

# ── Step 5：远端加载镜像并重启服务 ─────────────────────────
Step-Header "远端加载镜像并重启服务"
ssh "${RemoteUser}@${RemoteHost}" "chmod +x $RemotePath/remote-deploy.sh && bash $RemotePath/remote-deploy.sh $TarFile"
if ($LASTEXITCODE -ne 0) { Step-Fail "远端操作失败，可通过 ssh 登录查看日志" }
Step-OK

# ── Step 6：健康检查 ────────────────────────────────────────
Step-Header "健康检查  http://${RemoteHost}:5000/api/health"
$healthy = $false
for ($i = 1; $i -le 12; $i++) {
    Start-Sleep -Seconds 5
    $resp = ssh "${RemoteUser}@${RemoteHost}" "curl -sf http://localhost:5000/api/health 2>/dev/null" 2>$null
    if ($resp -match '"status":"OK"') {
        Write-Host "  $resp" -ForegroundColor DarkGray
        $healthy = $true
        break
    }
    Write-Host "  等待服务就绪... ($($i*5)s)" -ForegroundColor DarkGray
}
if (-not $healthy) { Step-Fail "服务健康检查超时（60s），请手动检查" }
Step-OK

# ── 清理本地 tar 包 ─────────────────────────────────────────
Write-Host "`n  清理本地临时文件 ($TarFile) ..." -ForegroundColor DarkGray
Remove-Item $TarFile -Force

# ── 完成摘要 ────────────────────────────────────────────────
$elapsed = [math]::Round(((Get-Date) - $StartTime).TotalSeconds)
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " 部署完成！耗时 ${elapsed}s"                -ForegroundColor Green
Write-Host " 访问地址：http://${RemoteHost}:5000"        -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green