@echo off
chcp 65001 >nul
mode con cols=100 lines=30

echo.
echo ========================================
echo       设备管理系统 - 开发环境
echo ========================================
echo.

echo [1/4] 检查环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js环境正常

echo.
echo [2/4] 安装依赖...
if not exist "node_modules" (
    echo 安装后端依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 后端依赖安装失败
        pause
        exit /b 1
    )
)

if not exist "client\node_modules" (
    echo 安装前端依赖...
    cd client
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 前端依赖安装失败
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo [3/4] 检查端口占用...
netstat -an | findstr ":5000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo ⚠️  端口5000已被占用，正在停止现有服务...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

netstat -an | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo ⚠️  端口3000已被占用，正在停止现有服务...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

echo.
echo [4/4] 启动开发服务器...
echo 🚀 启动开发环境...
echo    后端服务器: http://localhost:5000
echo    前端开发服务器: http://localhost:3000
echo    按 Ctrl+C 停止服务
echo.

echo 正在启动开发环境（前端+后端）...
echo 注意：这将同时启动前端和后端服务器
echo.

REM 使用package.json中定义的dev脚本，它会同时启动前端和后端
call npm run dev

echo.
echo 程序已结束
pause
