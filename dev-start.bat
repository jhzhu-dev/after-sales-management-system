@echo off
chcp 65001 >nul
mode con cols=100 lines=30

echo.
echo ========================================
echo       设备管理系统 - 开发环境
echo ========================================
echo.

echo [1/3] 检查环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js环境正常

echo.
echo [2/3] 安装依赖...
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
echo [3/3] 启动开发服务器...
echo 🚀 启动后端开发服务器...
start "后端开发服务器" cmd /k "set NODE_ENV=development && node server/index.js"

timeout /t 3 /nobreak >nul

echo 🚀 启动前端开发服务器...
start "前端开发服务器" cmd /k "cd client && npm start"

echo.
echo ✅ 开发环境已启动！
echo    后端API: http://localhost:5000
echo    前端开发: http://localhost:3000
echo    关闭此窗口不会停止服务器
echo.
pause
