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

echo [1/4] 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js环境检查通过

echo.
echo [2/4] 检查MySQL数据库配置...
echo    数据库配置: 用户名=els, 密码=111111, 数据库=device_management
echo ✅ 数据库配置已设置

echo.
echo [3/4] 安装项目依赖...
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
echo [4/4] 选择启动方式...
echo.
echo 请选择启动方式:
echo   1. 启动开发模式 (同时启动前后端) - 推荐
echo   2. 仅启动后端服务 (端口5000)
echo   3. 仅启动前端服务 (端口3000)
echo   4. 初始化数据库
echo   5. 插入模拟数据
echo   6. 完整设置 (安装+初始化+模拟数据)
echo   7. 退出
echo.

set /p choice=请输入选择 (1-7): 

if "%choice%"=="1" (
    echo.
    echo 🚀 启动开发模式...
    echo    前端地址: http://localhost:3000
    echo    后端地址: http://localhost:5000
    echo    按 Ctrl+C 停止服务
    echo.
    call npm run dev
) else if "%choice%"=="2" (
    echo.
    echo 🚀 启动后端服务...
    echo    后端地址: http://localhost:5000
    echo    按 Ctrl+C 停止服务
    echo.
    call npm run server
) else if "%choice%"=="3" (
    echo.
    echo 🚀 启动前端服务...
    echo    前端地址: http://localhost:3000
    echo    按 Ctrl+C 停止服务
    echo.
    call npm run client
) else if "%choice%"=="4" (
    echo.
    echo 🗄️ 初始化数据库...
    call npm run init-db
    echo.
    echo 数据库初始化完成，请重新运行脚本选择启动方式
    pause
) else if "%choice%"=="5" (
    echo.
    echo 🌱 插入模拟数据...
    call npm run seed
    echo.
    echo 模拟数据插入完成，请重新运行脚本选择启动方式
    pause
) else if "%choice%"=="6" (
    echo.
    echo 🔧 完整设置 (安装+初始化+模拟数据)...
    call npm run setup
    echo.
    echo 完整设置完成，请重新运行脚本选择启动方式
    pause
) else if "%choice%"=="7" (
    echo.
    echo 👋 退出程序
    exit /b 0
) else (
    echo.
    echo ❌ 无效选择，请输入1-7之间的数字
    pause
    exit /b 1
)

echo.
echo 程序已结束
pause
