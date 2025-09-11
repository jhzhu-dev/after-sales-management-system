@echo off
chcp 65001 >nul
mode con cols=100 lines=25

echo.
echo ========================================
echo       构建生产环境
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
echo [3/3] 构建前端...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)
cd ..

echo.
echo ✅ 生产环境构建完成！
echo    前端文件已构建到: client\build\
echo    可以运行 prod-start.bat 启动服务器
echo.
pause
