# =============================================================================
# backup.ps1
# 将本地备份目录同步到局域网 NAS
# NAS 路径: \\elsvision\jhzhu\After-sales-service
# 计划任务：每日 02:00 执行（由 setup-backup-task.ps1 注册）
#
# 前置条件：
#   已通过 setup-backup-task.ps1 将 NAS 凭据写入 Windows 凭据管理器
#   无需在本脚本中提供密码
# =============================================================================

param(
    [string]$LocalBackupDir = "$PSScriptRoot\backups",
    [string]$NasTarget      = "\\elsvision\jhzhu\After-sales-service",
    [int]   $NasRetainDays  = 14
)

$LogFile   = Join-Path $LocalBackupDir "sync.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $Line = "[$Timestamp] [$Level] $Message"
    Write-Host $Line
    Add-Content -Path $LogFile -Value $Line -Encoding UTF8
}

# ─── 确保本地备份目录存在 ────────────────────────────────────────────────────
if (-not (Test-Path $LocalBackupDir)) {
    Write-Log "Local backup directory not found: $LocalBackupDir" "ERROR"
    exit 1
}

Write-Log "=========================================="
Write-Log "Backup sync started"
Write-Log "Source : $LocalBackupDir"
Write-Log "Target : $NasTarget"

# ─── 检查 NAS 可达性 ─────────────────────────────────────────────────────────
Write-Log "Checking NAS availability..."
if (-not (Test-Path $NasTarget)) {
    Write-Log "NAS path not accessible: $NasTarget" "ERROR"
    Write-Log "Sync skipped. Local backups are intact." "WARN"
    exit 2
}
Write-Log "NAS is accessible."

# ─── robocopy 同步（镜像模式）────────────────────────────────────────────────
# /MIR  : 镜像同步，自动删除 NAS 上本地不存在的旧文件
# /Z    : 断点续传
# /W:5  : 失败重试等待 5 秒
# /R:3  : 失败最多重试 3 次
# /NP   : 不显示进度百分比（适合计划任务日志）
# /LOG+ : 追加到日志文件
$RobocopyLog = Join-Path $LocalBackupDir "robocopy.log"

Write-Log "Starting robocopy sync..."
robocopy $LocalBackupDir $NasTarget "*.sql.gz" `
    /MIR /Z /W:5 /R:3 /NP `
    /LOG+:$RobocopyLog

$ExitCode = $LASTEXITCODE

# robocopy 退出码说明：
#   0 = 无文件复制（源目标已一致）
#   1 = 有文件成功复制
#   2 = 有额外文件（NAS 有旧文件被清理）
#   3 = 1+2 组合
#   >= 8 = 有错误
if ($ExitCode -ge 8) {
    Write-Log "robocopy reported errors (exit code: $ExitCode). Check $RobocopyLog for details." "ERROR"
    exit 3
} else {
    Write-Log "robocopy sync completed (exit code: $ExitCode)."
}

# ─── 清理 NAS 上超过 NasRetainDays 天的旧备份 ────────────────────────────────
Write-Log "Cleaning NAS backups older than $NasRetainDays days..."
$CutoffDate = (Get-Date).AddDays(-$NasRetainDays)
$OldFiles = Get-ChildItem -Path $NasTarget -Filter "*.sql.gz" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $CutoffDate }

if ($OldFiles.Count -gt 0) {
    foreach ($File in $OldFiles) {
        Write-Log "Removing old NAS backup: $($File.Name) (last modified: $($File.LastWriteTime))"
        Remove-Item -Path $File.FullName -Force
    }
    Write-Log "Removed $($OldFiles.Count) old file(s) from NAS."
} else {
    Write-Log "No old files to remove from NAS."
}

# ─── 完成 ────────────────────────────────────────────────────────────────────
Write-Log "Sync completed successfully."
Write-Log "=========================================="
exit 0
