# =============================================================================
# restore.ps1 — 数据库恢复脚本
# 从 ./backups/ 中选择备份文件，恢复到运行中的 MySQL 容器
#
# 用法：
#   .\restore.ps1                          # 交互式选择备份文件
#   .\restore.ps1 -File "device_management_2026-03-03_0100.sql.gz"  # 指定文件
#   .\restore.ps1 -FromNas                 # 从 NAS 拉取备份文件列表
# =============================================================================

param(
  [string]$File     = "",
  [switch]$FromNas
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── 配置 ────────────────────────────────────────────────────────────────────
$ScriptDir       = $PSScriptRoot
$BackupDir       = Join-Path $ScriptDir "backups"
$NasPath         = "\\elsvision\jhzhu\After-sales-service"
$ContainerName   = "device-manager-db"
$DbUser          = "device_user"
$DbPass          = "device_pass_123"
$DbName          = "device_management"

Write-Host ""
Write-Host "=== 设备管理系统 — 数据库恢复工具 ===" -ForegroundColor Cyan
Write-Host ""

# ─── 确定备份来源目录 ─────────────────────────────────────────────────────────
$SourceDir = $BackupDir
if ($FromNas) {
  if (-not (Test-Path $NasPath)) {
    Write-Error "NAS 路径不可访问：$NasPath`n请确认网络连接和凭据（运行 setup-backup-task.ps1）。"
    exit 1
  }
  $SourceDir = $NasPath
  Write-Host "数据源：NAS ($NasPath)" -ForegroundColor Yellow
} else {
  Write-Host "数据源：本地备份目录 ($BackupDir)" -ForegroundColor Yellow
}

# ─── 列出可用备份文件 ─────────────────────────────────────────────────────────
$BackupFiles = Get-ChildItem -Path $SourceDir -Filter "*.sql.gz" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending

if ($BackupFiles.Count -eq 0) {
  Write-Error "未找到任何备份文件（路径：$SourceDir）"
  exit 1
}

# ─── 选择备份文件 ─────────────────────────────────────────────────────────────
$SelectedFile = $null

if ($File -ne "") {
  # 通过参数指定
  $SelectedFile = $BackupFiles | Where-Object { $_.Name -eq $File } | Select-Object -First 1
  if ($null -eq $SelectedFile) {
    Write-Error "指定的备份文件不存在：$File"
    exit 1
  }
} else {
  # 交互式列表选择
  Write-Host ""
  Write-Host "可用备份文件（最新在前）：" -ForegroundColor White
  Write-Host ("-" * 70)
  for ($i = 0; $i -lt $BackupFiles.Count; $i++) {
    $f = $BackupFiles[$i]
    $Size = "{0:N2} MB" -f ($f.Length / 1MB)
    $Time = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "  [$($i+1)] $($f.Name)  ($Size)  $Time"
  }
  Write-Host ("-" * 70)
  Write-Host ""

  do {
    $Input = Read-Host "请输入序号选择备份文件（1-$($BackupFiles.Count)）"
    $Index = 0
    $Valid = [int]::TryParse($Input, [ref]$Index) -and $Index -ge 1 -and $Index -le $BackupFiles.Count
    if (-not $Valid) {
      Write-Host "  无效输入，请重新输入。" -ForegroundColor Red
    }
  } while (-not $Valid)

  $SelectedFile = $BackupFiles[$Index - 1]
}

Write-Host ""
Write-Host "已选择：$($SelectedFile.Name)" -ForegroundColor Cyan
Write-Host "时间：$($SelectedFile.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
Write-Host "大小：$("{0:N2}" -f ($SelectedFile.Length / 1MB)) MB" -ForegroundColor Cyan
Write-Host ""

# ─── 安全确认 ─────────────────────────────────────────────────────────────────
Write-Host "⚠⚠⚠  警告  ⚠⚠⚠" -ForegroundColor Red
Write-Host "此操作将把数据库 '$DbName' 恢复到所选备份的状态。" -ForegroundColor Red
Write-Host "当前数据库中所有数据将被备份文件覆盖，此操作【不可撤销】！" -ForegroundColor Red
Write-Host ""
$Confirm = Read-Host "确认继续？请输入 yes 以确认，其他任意输入取消"

if ($Confirm -ne "yes") {
  Write-Host ""
  Write-Host "操作已取消，数据库未做任何变更。" -ForegroundColor Green
  exit 0
}

# ─── 检查容器运行状态 ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "检查 MySQL 容器状态..." -ForegroundColor Yellow
$ContainerStatus = docker inspect --format="{{.State.Running}}" $ContainerName 2>&1
if ($ContainerStatus -ne "true") {
  Write-Error "MySQL 容器 '$ContainerName' 未运行，请先执行：docker-compose up -d"
  exit 1
}
Write-Host "  ✓ 容器运行正常" -ForegroundColor Green

# ─── 复制备份文件到容器内并恢复 ──────────────────────────────────────────────
Write-Host ""
Write-Host "正在恢复数据库，请稍候..." -ForegroundColor Yellow

# 将备份文件复制到容器的 /tmp/ 目录
$TmpName = "restore_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql.gz"
docker cp $SelectedFile.FullName "${ContainerName}:/tmp/$TmpName"

# 在容器内解压并导入
$RestoreCmd = "gunzip < /tmp/$TmpName | mysql -u $DbUser -p$DbPass $DbName && rm -f /tmp/$TmpName"
docker exec $ContainerName bash -c $RestoreCmd

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✓ Restore completed!" -ForegroundColor Green
  Write-Host "  数据库已成功恢复到：$($SelectedFile.Name)" -ForegroundColor Green
  Write-Host "  恢复时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
} else {
  Write-Error "数据库恢复失败！请检查上方错误信息，或联系系统管理员。"
  exit 1
}

Write-Host ""
