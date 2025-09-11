@echo off
:: 设置控制台编码为UTF-8
chcp 65001 >nul
:: 设置控制台字体为支持中文的字体
mode con cols=120 lines=30

echo.
echo ========================================
echo           设备管理系统启动脚本
echo ========================================
echo.

echo [1/3] 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js环境检查通过

echo.
echo [2/3] 安装项目依赖...
echo    正在安装后端依赖...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 后端依赖安装完成

echo    正在安装前端依赖...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
cd ..
echo ✅ 前端依赖安装完成

echo.
echo [3/3] 启动开发模式...
echo.
echo 🚀 正在启动设备管理系统...
echo    前端地址: http://localhost:3000
echo    后端地址: http://localhost:5000
echo    按 Ctrl+C 停止服务
echo.

call npm run dev

echo.
echo 程序已结束
pause