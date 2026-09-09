# ============================================================
# deploy-to-181-preview.ps1  预览展示版部署脚本（不影响生产环境）
#
# 与 deploy-to-181.ps1（生产部署）的区别：
#   - 镜像标签为 device-manager-app:preview，与生产 :latest 互不覆盖
#   - 部署目录为 /home/els/manger-preview（生产在 /home/els/manger）
#   - 生成预览专用 .env（独立 OSS 目录 / JWT 密钥）
#   - 远端使用 remote-deploy-preview.sh，端口 5010
#
# 使用方式：
#   .\deploy-to-181-preview.ps1               # 完整构建 + 部署
#   .\deploy-to-181-preview.ps1 -SkipBuild    # 跳过 Docker 构建（直接用现有镜像）
#   .\deploy-to-181-preview.ps1 -RefreshData  # 部署并用生产最新备份刷新预览数据
#   .\deploy-to-181-preview.ps1 -SeedData     # 清空预览库，重建空表并灌入全部虚构演示数据
# ============================================================
param(
    [string]$RemoteHost  = "192.168.0.181",
    [string]$RemoteUser  = "els",
    [string]$RemotePath  = "/home/els/manger-preview",
    [string]$ImageName   = "device-manager-app",
    [string]$ImageTag    = "preview",
    [int]$PreviewPort    = 5010,
    [switch]$SkipBuild   = $false,
    [switch]$RefreshData = $false,
    [switch]$SeedData    = $false
)

$TarFile    = "device-manager-app-$ImageTag.tar"
$StartTime  = Get-Date
$TotalSteps = if ($SkipBuild) { 5 } else { 6 }
$Step       = 0

function Step-Header {
    param([string]$Title)
    $script:Step++
    Write-Host "`n[$script:Step/$TotalSteps] $Title" -ForegroundColor Yellow
}

function Step-OK { Write-Host "  OK" -ForegroundColor Green }
function Step-Fail {
    param([string]$Msg)
    Write-Host "`n  [ERROR] $Msg" -ForegroundColor Red
    if (Test-Path $TarFile) { Remove-Item $TarFile -Force -ErrorAction SilentlyContinue }
    exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 售后登记系统 预览版  →  $RemoteHost`:$PreviewPort" -ForegroundColor Cyan
Write-Host " 开始时间: $(Get-Date -Format 'HH:mm:ss')"          -ForegroundColor Cyan
Write-Host " 注意: 不影响生产环境 (5000/5001)"                  -ForegroundColor DarkCyan
if ($SkipBuild)   { Write-Host " 模式: 跳过构建，直接部署现有镜像" -ForegroundColor DarkCyan }
if ($RefreshData) { Write-Host " 模式: 部署后用生产最新备份刷新预览数据" -ForegroundColor DarkCyan }
if ($SeedData)    { Write-Host " 模式: 清空预览库并灌入全部虚构演示数据（不导入生产备份）" -ForegroundColor DarkCyan }
if ($RefreshData -and $SeedData) {
    Write-Host "`n  [ERROR] -RefreshData 与 -SeedData 不能同时使用" -ForegroundColor Red
    exit 1
}
Write-Host "============================================" -ForegroundColor Cyan

# ── Step 1（可选）：构建 Docker 镜像 ────────────────────────
if (-not $SkipBuild) {
    Step-Header "构建 Docker 镜像 (manger-app:latest)"
    $buildFailed = $false
    docker build -t manger-app:latest . 2>&1 | ForEach-Object {
        $line = "$_"
        if ($line -match '^#\d+ ERROR') {
            Write-Host "  $line" -ForegroundColor Red
            $buildFailed = $true
        } elseif ($line -match 'DONE|CACHED') {
            Write-Host "  $line" -ForegroundColor DarkGray
        } else {
            Write-Host "  $line"
        }
    }
    $imageExists = (docker images manger-app:latest --format "{{.ID}}" 2>$null) -ne ''
    if ($buildFailed -or -not $imageExists) {
        Step-Fail "Docker 构建失败，请检查上方日志"
    }
    Step-OK
}

# ── Step 2：打预览版标签 ────────────────────────────────────
Step-Header "打镜像标签 $ImageName`:$ImageTag"
docker tag manger-app:latest "$ImageName`:$ImageTag" 2>&1 | Out-Null
if ((docker images "$ImageName`:$ImageTag" --format "{{.ID}}" 2>$null) -eq '') {
    Step-Fail "打标签失败，源镜像 manger-app:latest 不存在"
}
Step-OK

# ── Step 3：导出镜像为 tar ──────────────────────────────────
Step-Header "导出镜像  →  $TarFile"
docker save "$ImageName`:$ImageTag" -o $TarFile 2>&1 | Out-Null
if (-not (Test-Path $TarFile)) { Step-Fail "镜像导出失败" }
$sizeMB = [math]::Round((Get-Item $TarFile).Length / 1MB, 1)
Write-Host "  大小: $sizeMB MB" -ForegroundColor DarkGray
Step-OK

# ── Step 4：生成预览专用 .env 并传输文件到远端 ───────────────
Step-Header "传输文件  →  ${RemoteUser}@${RemoteHost}:${RemotePath}"

if (-not (Test-Path ".env")) {
    Step-Fail "未找到 .env（预览版需复用其中的 OSS 密钥与登录配置）"
}

# 生成预览 .env：保留 OSS 密钥/登录账号，替换 OSS 目录、JWT 密钥、系统地址
$srcLines = Get-Content ".env"
$dropPattern = '^(OSS_BASE_PATH|SYSTEM_BASE_URL|JWT_SECRET)\s*='
$kept = $srcLines | Where-Object { $_ -notmatch $dropPattern }
$previewEnv = $kept + @(
    "",
    "# ===== 预览版覆盖配置（deploy-to-181-preview.ps1 自动生成）=====",
    "OSS_BASE_PATH=static/After-sales management system-preview",
    "SYSTEM_BASE_URL=http://${RemoteHost}:${PreviewPort}",
    "JWT_SECRET=preview_jwt_secret_2026"
)
$envTmp = Join-Path $env:TEMP ".env.preview"
Set-Content -Path $envTmp -Value $previewEnv -Encoding UTF8
Write-Host "  已生成预览 .env（OSS 目录 -preview 后缀 / 独立 JWT）" -ForegroundColor DarkGray

Write-Host "  检查 SSH 连接..." -ForegroundColor DarkGray
ssh "${RemoteUser}@${RemoteHost}" "mkdir -p $RemotePath/uploads" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Step-Fail "SSH 连接失败。请确认公钥已添加到远端 ~/.ssh/authorized_keys"
}

Write-Host "  传输镜像包 ($sizeMB MB)..." -ForegroundColor DarkGray
scp -C $TarFile "${RemoteUser}@${RemoteHost}:${RemotePath}/"
if ($LASTEXITCODE -ne 0) { Step-Fail "镜像传输失败" }

Write-Host "  传输 docker-compose.preview.yml → 远端 docker-compose.yml ..." -ForegroundColor DarkGray
scp docker-compose.preview.yml "${RemoteUser}@${RemoteHost}:${RemotePath}/docker-compose.yml"
if ($LASTEXITCODE -ne 0) { Step-Fail "compose 文件传输失败" }

Write-Host "  传输 .env ..." -ForegroundColor DarkGray
scp $envTmp "${RemoteUser}@${RemoteHost}:${RemotePath}/.env"
if ($LASTEXITCODE -ne 0) { Step-Fail ".env 传输失败" }

Write-Host "  传输部署脚本 ..." -ForegroundColor DarkGray
scp scripts/remote-deploy-preview.sh "${RemoteUser}@${RemoteHost}:${RemotePath}/remote-deploy-preview.sh"
if ($LASTEXITCODE -ne 0) { Step-Fail "部署脚本传输失败" }
Step-OK

# ── Step 5：远端加载镜像并启动预览服务 ──────────────────────
Step-Header "远端加载镜像并启动预览服务"
$remoteArgs = "$TarFile"
if ($RefreshData) { $remoteArgs = "$TarFile refresh" }
if ($SeedData)    { $remoteArgs = "$TarFile seed" }
ssh "${RemoteUser}@${RemoteHost}" "cd $RemotePath && chmod +x remote-deploy-preview.sh && bash remote-deploy-preview.sh $remoteArgs"
if ($LASTEXITCODE -ne 0) {
    Step-Fail "远端操作失败。排查命令: ssh ${RemoteUser}@${RemoteHost} 'cd $RemotePath && docker compose logs app --tail=50'"
}
Step-OK

# ── Step 6：健康检查 ────────────────────────────────────────
Step-Header "健康检查  http://${RemoteHost}:${PreviewPort}/api/health"
$healthy = $false
for ($i = 1; $i -le 12; $i++) {
    Start-Sleep -Seconds 5
    $resp = ssh "${RemoteUser}@${RemoteHost}" "curl -sf http://localhost:${PreviewPort}/api/health 2>/dev/null" 2>$null
    if ($resp -match '"status":"OK"') {
        Write-Host "  $resp" -ForegroundColor DarkGray
        $healthy = $true
        break
    }
    Write-Host "  等待服务就绪... ($($i*5)s)" -ForegroundColor DarkGray
}
if (-not $healthy) { Step-Fail "预览服务健康检查超时（60s），请手动检查" }
Step-OK

# ── 清理本地临时文件 ────────────────────────────────────────
Write-Host "`n  清理本地临时文件 ($TarFile, .env.preview) ..." -ForegroundColor DarkGray
Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
Remove-Item $envTmp  -Force -ErrorAction SilentlyContinue

$elapsed = [math]::Round(((Get-Date) - $StartTime).TotalMinutes, 1)
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " 预览版部署完成 (耗时 ${elapsed} 分钟)"              -ForegroundColor Green
Write-Host " 预览地址:  http://${RemoteHost}:${PreviewPort}"      -ForegroundColor Green
Write-Host " 生产地址:  http://${RemoteHost}:5000 (不受影响)"     -ForegroundColor Green
Write-Host " 首次访问会从生产备份导入数据；登录账号与生产一致"     -ForegroundColor DarkCyan
Write-Host " 回滚: ssh ${RemoteUser}@${RemoteHost} 'cd $RemotePath && docker compose down'" -ForegroundColor DarkCyan
Write-Host " 彻底删除: ssh ${RemoteUser}@${RemoteHost} 'cd $RemotePath && docker compose down -v'" -ForegroundColor DarkCyan
Write-Host "============================================" -ForegroundColor Cyan
