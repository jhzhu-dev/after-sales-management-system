@echo off
chcp 65001 >nul
mode con cols=100 lines=25

echo.
echo ========================================
echo       安装项目依赖
echo ========================================
echo.

echo [1/2] 检查环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js环境正常

echo.
echo [2/2] 安装依赖...
echo 安装后端依赖...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)

echo 安装前端依赖...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
cd ..

echo.
echo ✅ 所有依赖安装完成！
echo    可以运行 dev-start.bat 或 prod-start.bat 启动服务器
echo.
pause
