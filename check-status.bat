@echo off
chcp 65001 >nul
mode con cols=100 lines=30

echo.
echo ========================================
echo       系统状态检查
echo ========================================
echo.

echo [1/4] 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js未安装
) else (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js版本: %%i
)

echo.
echo [2/4] 检查依赖安装...
if exist "node_modules" (
    echo ✅ 后端依赖已安装
) else (
    echo ❌ 后端依赖未安装
)

if exist "client\node_modules" (
    echo ✅ 前端依赖已安装
) else (
    echo ❌ 前端依赖未安装
)

echo.
echo [3/4] 检查构建文件...
if exist "client\build\index.html" (
    echo ✅ 前端构建文件已存在
) else (
    echo ❌ 前端构建文件不存在
)

echo.
echo [4/4] 检查服务器状态...
netstat -an | findstr ":5000" >nul
if %errorlevel% equ 0 (
    echo ✅ HTTP服务器运行中 (端口5000)
) else (
    echo ❌ HTTP服务器未运行
)

netstat -an | findstr ":5001" >nul
if %errorlevel% equ 0 (
    echo ✅ HTTPS服务器运行中 (端口5001)
) else (
    echo ❌ HTTPS服务器未运行
)

echo.
echo [5/5] 检查SSL证书...
if exist "ssl\server-key.pem" (
    echo ✅ SSL私钥文件存在
) else (
    echo ❌ SSL私钥文件不存在
)

if exist "ssl\server-cert.pem" (
    echo ✅ SSL证书文件存在
) else (
    echo ❌ SSL证书文件不存在
)

echo.
pause
