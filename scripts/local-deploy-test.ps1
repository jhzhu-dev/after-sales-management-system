# ============================================================
# local-deploy-test.ps1 — 生产数据库拷贝回本地做部署测试
#
# 流程：触发生产备份 → 下载到 tmp/ → 本地构建镜像(含 tsc 门禁) →
#       启动本地 MySQL → 导入生产数据 → 清空 feishu_config(阻断真实通知) →
#       启动应用 → 健康检查 + 数据量核对
#
# 用法：
#   .\scripts\local-deploy-test.ps1                            # 自动触发生产最新备份并下载
#   .\scripts\local-deploy-test.ps1 -DumpFile tmp\xxx.sql.gz   # 使用本地已有备份
#   .\scripts\local-deploy-test.ps1 -SkipBuild                 # 复用已构建镜像（仅重新导数据）
# ============================================================
param(
    [string]$RemoteHost = "192.168.0.181",
    [string]$RemoteUser = "els",
    [string]$DumpFile   = "",
    [switch]$SkipBuild  = $false
)

# 注意：不能设为 "Stop"——PS 5.1 会把原生命令（mysql/scp 等）输出到 stderr 的
# 内容（如密码警告）当成终止错误。本脚本统一用 $LASTEXITCODE / try-catch 判错。
$ErrorActionPreference = "Continue"
$Project      = "manger-localtest"
$ComposeArgs  = @("-p", $Project, "-f", "docker-compose.localtest.yml")
$DbContainer  = "dm-localtest-db"
$RootPass     = "localtest_root_2026"
# 注意：必须用带引号的完整字符串传 -p 参数；裸写 -p$RootPass 会被 PowerShell
# 拆成两个参数，导致 mysql 收不到正确密码（Access denied）
$pwdArg       = "-p$RootPass"
$BaseUrl      = "http://localhost:5020"

function Step($t) { Write-Host "`n==> $t" -ForegroundColor Yellow }
function Ok($m)   { Write-Host "    OK: $m" -ForegroundColor Green }
function Fail($m) { Write-Host "`n    [ERROR] $m" -ForegroundColor Red; exit 1 }

Push-Location (Split-Path $PSScriptRoot -Parent)
try {

    # ── Step 1：获取生产备份 ────────────────────────────────────
    Step "Step 1/7 获取生产数据库备份"
    New-Item -ItemType Directory -Force -Path tmp | Out-Null
    if (-not $DumpFile) {
        Write-Host "    触发服务器全量备份..."
        ssh "${RemoteUser}@${RemoteHost}" "docker exec device-manager-db-backup /bin/bash /backup.sh" | Select-Object -Last 2
        if ($LASTEXITCODE -ne 0) { Fail "服务器备份失败" }
        $remoteFile = ssh "${RemoteUser}@${RemoteHost}" "ls -t /home/els/manger/backups/device_management_*.sql.gz | head -1"
        $localName  = Split-Path $remoteFile -Leaf
        Write-Host "    下载 $localName ..."
        scp "${RemoteUser}@${RemoteHost}:${remoteFile}" "tmp/"
        if ($LASTEXITCODE -ne 0) { Fail "备份下载失败" }
        $DumpFile = "tmp/$localName"
    }
    if (-not (Test-Path $DumpFile)) { Fail "备份文件不存在: $DumpFile" }
    $sizeKB = [math]::Round((Get-Item $DumpFile).Length / 1KB, 0)
    Ok "使用备份 $DumpFile ($sizeKB KB)"

    # ── Step 2：构建镜像（tsc + vite 构建即上线门禁）────────────
    if (-not $SkipBuild) {
        Step "Step 2/7 构建 Docker 镜像（tsc + vite 构建门禁）"
        docker compose @ComposeArgs build app
        if ($LASTEXITCODE -ne 0) { Fail "镜像构建失败（请检查上方 tsc/vite 输出）" }
        Ok "镜像构建成功"
    } else {
        Step "Step 2/7 跳过构建（-SkipBuild）"
    }

    # ── Step 3：启动本地 MySQL 并等待就绪 ───────────────────────
    Step "Step 3/7 启动本地 MySQL（清空旧测试卷，全新导入）"
    docker compose @ComposeArgs down -v --remove-orphans 2>$null | Out-Null
    docker compose @ComposeArgs up -d mysql
    if ($LASTEXITCODE -ne 0) { Fail "MySQL 启动失败" }
    Write-Host "    等待数据库就绪（SELECT 1 门禁，规避 mysqladmin 初始化期误报）..."
    $waited = 0
    $lastErr = ""
    while ($true) {
        $out = docker exec $DbContainer mysql -uroot $pwdArg -e "SELECT 1;" 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) { break }
        $lastErr = ($out.Trim() -split "`r?`n" | Select-Object -Last 1)
        if ($waited -ge 180) { Fail "数据库 180s 内未就绪（最后错误: $lastErr）" }
        if ($waited % 15 -eq 0) { Write-Host "    ...未就绪 (${waited}s): $lastErr" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 5; $waited += 5
    }
    Ok "数据库就绪 (等待 ${waited}s)"

    # ── Step 4：导入生产数据 ────────────────────────────────────
    Step "Step 4/7 导入生产数据"
    docker cp $DumpFile "${DbContainer}:/tmp/dump.sql.gz"
    if ($LASTEXITCODE -ne 0) { Fail "备份拷贝进容器失败" }
    docker exec $DbContainer sh -c "gunzip -c /tmp/dump.sql.gz | mysql -uroot -p$RootPass"
    if ($LASTEXITCODE -ne 0) { Fail "数据导入失败" }
    docker exec $DbContainer sh -c "rm -f /tmp/dump.sql.gz"
    $tables = (docker exec $DbContainer mysql -N -uroot $pwdArg -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='device_management';" 2>$null)
    Ok "导入完成，device_management 共 $($tables.Trim()) 张表"

    # ── Step 5：清空 feishu_config（阻断真实飞书通知，安全关键）─
    Step "Step 5/7 清空 feishu_config（阻断对真实用户的飞书通知）"
    docker exec $DbContainer mysql -uroot $pwdArg device_management -e "DELETE FROM feishu_config;" 2>$null
    if ($LASTEXITCODE -ne 0) { Fail "feishu_config 清空失败" }
    Ok "feishu_config 已清空"

    # ── Step 6：启动应用 + 健康检查 ─────────────────────────────
    Step "Step 6/7 启动应用"
    docker compose @ComposeArgs up -d app
    if ($LASTEXITCODE -ne 0) { Fail "应用启动失败" }
    $healthy = $false
    for ($i = 1; $i -le 24; $i++) {
        Start-Sleep -Seconds 5
        try { $h = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 5 } catch { $h = $null }
        if ($h -and $h.status -eq "OK") { $healthy = $true; break }
        Write-Host "    等待应用就绪... ($($i*5)s)" -ForegroundColor DarkGray
    }
    if (-not $healthy) {
        docker compose @ComposeArgs logs app --tail 40
        Fail "应用健康检查超时（120s）"
    }
    Ok "健康检查通过: $BaseUrl/api/health"

    # ── Step 7：登录 + 数据量核对 ───────────────────────────────
    Step "Step 7/7 登录与数据量核对"
    $loginUser = "elsvision"; $loginPass = "elsvisiongo666"
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match "^LOGIN_USERNAME=(.+)$") { $loginUser = $Matches[1].Trim() }
            if ($_ -match "^LOGIN_PASSWORD=(.+)$") { $loginPass = $Matches[1].Trim() }
        }
    }
    $body = @{ username = $loginUser; password = $loginPass } | ConvertTo-Json
    try {
        $login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
    } catch { Fail "登录失败: $($_.Exception.Message)" }
    $headers = @{ Authorization = "Bearer $($login.token)" }
    # 注：接口返回结构为 {success, data:[...]}（部分接口含 total），统一按 data 数组计数
    $checks = @(
        @{ name = "设备";     path = "/api/devices?limit=9999" },
        @{ name = "问题";     path = "/api/issues?limit=9999" },
        @{ name = "客户需求"; path = "/api/customer-requirements?limit=9999" },
        @{ name = "测试任务"; path = "/api/test-tasks?limit=9999" },
        @{ name = "产品";     path = "/api/products?limit=9999" },
        @{ name = "客户";     path = "/api/customers?limit=9999" },
        @{ name = "知识库";   path = "/api/kb-articles?limit=9999" }
    )
    foreach ($c in $checks) {
        try {
            $r = Invoke-RestMethod -Uri "$BaseUrl$($c.path)" -Headers $headers -TimeoutSec 30
            $n = if ($r.data -is [array]) { $r.data.Count } elseif ($null -ne $r.total) { $r.total } else { 0 }
            Write-Host ("    {0,-6} {1} 条" -f $c.name, $n)
        } catch {
            Write-Host ("    {0,-6} 查询失败: {1}" -f $c.name, $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }
    # 与数据库直查交叉核对（数据以导入的备份为准）
    Write-Host "    --- 数据库直查（导入基准）---" -ForegroundColor DarkGray
    docker exec $DbContainer mysql -N -uroot $pwdArg device_management -e "SELECT CONCAT('    devices=', COUNT(*)) FROM devices UNION ALL SELECT CONCAT('    customers=', COUNT(*)) FROM customers UNION ALL SELECT CONCAT('    issues=', COUNT(*)) FROM issues UNION ALL SELECT CONCAT('    products=', COUNT(*)) FROM products;" 2>$null

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host " 本地部署测试环境就绪: $BaseUrl"              -ForegroundColor Green
    Write-Host " 数据库: 容器 $DbContainer (宿主机端口 3308)"  -ForegroundColor Green
    Write-Host " 在浏览器人工验证核心功能后，如确认无误："      -ForegroundColor Green
    Write-Host "   → 执行生产部署: .\deploy-to-181.ps1"        -ForegroundColor Green
    Write-Host " 测试完清理:"                                  -ForegroundColor Green
    Write-Host "   docker compose -p $Project -f docker-compose.localtest.yml down -v" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green

} finally {
    Pop-Location
}
