@echo off
chcp 65001 >nul
mode con cols=80 lines=20

echo.
echo ========================================
echo       停止开发环境服务器
echo ========================================
echo.

echo 正在停止所有Node.js进程...
taskkill /f /im node.exe >nul 2>&1

echo ✅ 开发环境服务器已停止
echo.
pause
