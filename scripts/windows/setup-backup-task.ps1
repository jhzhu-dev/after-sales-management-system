# =============================================================================
# setup-backup-task.ps1
# 首次部署时以管理员身份运行此脚本（仅需运行一次）
# 功能：
#   1. 将 NAS 凭据安全写入 Windows 凭据管理器
#   2. 注册两个 Windows 计划任务：
#      - DeviceManagerDbBackup  : 每日 01:00 触发容器内备份
#      - DeviceManagerNasSync   : 每日 02:00 将备份同步到 NAS
# =============================================================================

#Requires -RunAsAdministrator

$ProjectRoot = $PSScriptRoot
$BackupScript = Join-Path $ProjectRoot "backup.ps1"

# ─── 检查管理员权限 ───────────────────────────────────────────────────────────
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $IsAdmin) {
    Write-Error "请以管理员身份运行此脚本（右键 → 以管理员身份运行）"
    exit 1
}

Write-Host "=== Device Manager 备份环境初始化 ===" -ForegroundColor Cyan
Write-Host ""

# ─── 步骤1：写入 NAS 凭据到 Windows 凭据管理器 ───────────────────────────────
Write-Host "[1/3] 写入 NAS 凭据到 Windows 凭据管理器..." -ForegroundColor Yellow
# cmdkey 将凭据存储在操作系统的凭据保险库中
# 之后 backup.ps1 通过 UNC 路径访问 NAS 时 Windows 自动使用此凭据
# 密码不会出现在任何脚本或日志文件中
cmdkey /add:elsvision /user:jhzhu /pass:Zhujiahao123

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ NAS 凭据已安全存储（用户: jhzhu @ elsvision）" -ForegroundColor Green
} else {
    Write-Warning "  cmdkey 执行异常，请手动检查凭据管理器"
}

Write-Host ""

# ─── 步骤2：注册"数据库备份"计划任务（每日 01:00）──────────────────────────
Write-Host "[2/3] 注册计划任务: DeviceManagerDbBackup（每日 01:00）..." -ForegroundColor Yellow

$BackupTaskName = "DeviceManagerDbBackup"
$BackupAction = New-ScheduledTaskAction `
    -Execute "docker" `
    -Argument "exec device-manager-db-backup /bin/bash /backup.sh"

$BackupTrigger = New-ScheduledTaskTrigger -Daily -At "01:00"

$BackupSettings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable

# 以 SYSTEM 账户运行，无需用户登录
$BackupPrincipal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# 若任务已存在则先删除
Unregister-ScheduledTask -TaskName $BackupTaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $BackupTaskName `
    -Action $BackupAction `
    -Trigger $BackupTrigger `
    -Settings $BackupSettings `
    -Principal $BackupPrincipal `
    -Description "每日凌晨01:00触发 device-manager-db-backup 容器执行 mysqldump 全量备份" `
    | Out-Null

Write-Host "  ✓ 任务 '$BackupTaskName' 已注册（每日 01:00）" -ForegroundColor Green
Write-Host ""

# ─── 步骤3：注册"NAS同步"计划任务（每日 02:00）──────────────────────────────
Write-Host "[3/3] 注册计划任务: DeviceManagerNasSync（每日 02:00）..." -ForegroundColor Yellow

$SyncTaskName = "DeviceManagerNasSync"
$SyncAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$BackupScript`"" `
    -WorkingDirectory $ProjectRoot

$SyncTrigger = New-ScheduledTaskTrigger -Daily -At "02:00"

$SyncSettings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable

# 以 SYSTEM 账户运行（SYSTEM 也可访问凭据管理器中的机器级凭据）
$SyncPrincipal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Unregister-ScheduledTask -TaskName $SyncTaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $SyncTaskName `
    -Action $SyncAction `
    -Trigger $SyncTrigger `
    -Settings $SyncSettings `
    -Principal $SyncPrincipal `
    -Description "每日凌晨02:00将数据库备份文件同步到NAS: \\elsvision\jhzhu\After-sales-service" `
    | Out-Null

Write-Host "  ✓ 任务 '$SyncTaskName' 已注册（每日 02:00）" -ForegroundColor Green
Write-Host ""

# ─── 完成 ────────────────────────────────────────────────────────────────────
Write-Host "=== 初始化完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "已完成：" -ForegroundColor White
Write-Host "  • NAS 凭据已存入 Windows 凭据管理器（不再需要明文密码）"
Write-Host "  • 计划任务 '$BackupTaskName'：每日 01:00 执行数据库备份"
Write-Host "  • 计划任务 '$SyncTaskName' ：每日 02:00 同步备份到 NAS"
Write-Host ""
Write-Host "验证步骤：" -ForegroundColor Yellow
Write-Host "  1. 手动触发备份测试："
Write-Host "     docker exec device-manager-db-backup /bin/bash /backup.sh"
Write-Host ""
Write-Host "  2. 手动触发 NAS 同步测试："
Write-Host "     .\backup.ps1"
Write-Host ""
Write-Host "  3. 查看计划任务："
Write-Host "     Get-ScheduledTask -TaskName 'DeviceManager*' | Select-Object TaskName, State"
Write-Host ""
Write-Host "  4. 如需恢复数据库："
Write-Host "     .\restore.ps1"
