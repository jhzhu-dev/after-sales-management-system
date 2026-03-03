# ============================================================
# deploy-to-181.ps1  打包并部署到 192.168.0.181
# 使用方式：.\deploy-to-181.ps1
#           .\deploy-to-181.ps1 -RemoteUser els
# ============================================================
param(
    [string]$RemoteHost  = "192.168.0.181",
    [string]$RemoteUser  = "els",
    [string]$RemotePath  = "/home/els/manger",
    [string]$ImageName   = "device-manager-app",
    [string]$Version     = "0.181"
)

$TarFile = "device-manager-app-$Version.tar"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 售后登记系统 v$Version    $RemoteHost"    -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

#  Step 1: 打标签 
Write-Host "`n[1/5] 打镜像标签 $ImageName`:$Version ..." -ForegroundColor Yellow
docker tag manger-app:latest "$ImageName`:$Version"
docker tag manger-app:latest "$ImageName`:latest"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] 打标签失败" -ForegroundColor Red; exit 1 }
Write-Host "  OK" -ForegroundColor Green

#  Step 2: 导出镜像 
Write-Host "`n[2/5] 导出镜像  $TarFile ..." -ForegroundColor Yellow
docker save "$ImageName`:$Version" -o $TarFile
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] 导出失败" -ForegroundColor Red; exit 1 }
$sizeMB = [math]::Round((Get-Item $TarFile).Length / 1MB, 1)
Write-Host "  OK  ($sizeMB MB)" -ForegroundColor Green

#  Step 3: 传输文件到远程机器 
Write-Host "`n[3/5] 传输文件到 ${RemoteUser}@${RemoteHost}:${RemotePath} ..." -ForegroundColor Yellow

# 确保远程目录存在
ssh "${RemoteUser}@${RemoteHost}" "mkdir -p $RemotePath/ssl $RemotePath/uploads $RemotePath/backups"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] SSH 连接失败。请确认：" -ForegroundColor Red
    Write-Host "  1. 已将本机公钥加入 ${RemoteUser}@${RemoteHost} 的 ~/.ssh/authorized_keys" -ForegroundColor Yellow
    Write-Host "  2. 或首次连接时手动输入密码" -ForegroundColor Yellow
    exit 1
}

Write-Host "   传输镜像包 ($sizeMB MB)..."
scp -C $TarFile "${RemoteUser}@${RemoteHost}:${RemotePath}/"

Write-Host "   传输 docker-compose.yml ..."
scp docker-compose.linux.yml "${RemoteUser}@${RemoteHost}:${RemotePath}/docker-compose.yml"

if (Test-Path ".env") {
    Write-Host "   传输 .env ..."
    scp .env "${RemoteUser}@${RemoteHost}:${RemotePath}/.env"
} elseif (Test-Path "env.example") {
    Write-Host "  [WARN] 未找到 .env，上传 env.example，请在远程机器上修改敏感配置" -ForegroundColor Yellow
    scp env.example "${RemoteUser}@${RemoteHost}:${RemotePath}/.env"
}

Write-Host "   传输部署脚本 ..."
scp remote-deploy.sh "${RemoteUser}@${RemoteHost}:${RemotePath}/remote-deploy.sh"

if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] 文件传输失败" -ForegroundColor Red; exit 1 }
Write-Host "  OK" -ForegroundColor Green

#  Step 4: 远程加载镜像并重启服务 
Write-Host "`n[4/5] 远程加载镜像并更新服务 ..." -ForegroundColor Yellow
ssh "${RemoteUser}@${RemoteHost}" "chmod +x $RemotePath/remote-deploy.sh && bash $RemotePath/remote-deploy.sh $TarFile"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] 远程部署失败，请 ssh 登录后查看日志" -ForegroundColor Red; exit 1 }
Write-Host "  OK" -ForegroundColor Green

#  Step 5: 清理本地临时文件 
Write-Host "`n[5/5] 清理本地临时文件 ($TarFile) ..." -ForegroundColor Yellow
Remove-Item $TarFile -Force
Write-Host "  OK" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " 部署完成！" -ForegroundColor Green
Write-Host " 访问地址：http://${RemoteHost}:5000"        -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
