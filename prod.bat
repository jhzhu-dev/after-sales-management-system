@echo off
chcp 65001 >nul
mode con cols=100 lines=30

echo.
echo ========================================
echo       设备管理系统 - 生产环境
echo ========================================
echo.

echo [1/5] 检查环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js环境正常

echo.
echo [2/5] 安装依赖...
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
echo [3/5] 检查前端构建状态...
if not exist "client\build\index.html" (
    echo 🔨 前端未构建，开始构建...
    cd client
    call npm run build
    if %errorlevel% neq 0 (
        echo ❌ 前端构建失败
        pause
        exit /b 1
    )
    cd ..
    echo ✅ 前端构建完成
) else (
    echo 📁 检查前端文件是否需要更新...
    
    REM 简化检查逻辑，直接重新构建以确保最新
    echo 🔄 重新构建前端以确保最新版本...
    cd client
    call npm run build
    if %errorlevel% neq 0 (
        echo ❌ 前端构建失败
        pause
        exit /b 1
    )
    cd ..
    echo ✅ 前端重新构建完成
)

echo.
echo [4/5] 检查服务器状态...
netstat -an | findstr ":5000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo ⚠️  端口5000已被占用，正在停止现有服务...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

echo.
echo [5/5] 启动生产服务器...
echo 🚀 启动生产服务器...
echo    本地访问: http://localhost:5000
echo    HTTPS访问: https://localhost:5001
echo    按 Ctrl+C 停止服务
echo.

set NODE_ENV=production
call npm start

echo.
echo 程序已结束
pause
