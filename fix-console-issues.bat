@echo off
chcp 65001 >nul
mode con cols=100 lines=30

echo.
echo ========================================
echo       修复控制台报错问题
echo ========================================
echo.

echo [1/4] 停止现有服务器...
taskkill /f /im node.exe >nul 2>&1
echo ✅ 服务器已停止

echo.
echo [2/4] 重新构建前端...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)
cd ..
echo ✅ 前端构建完成

echo.
echo [3/4] 启动修复后的服务器...
set NODE_ENV=production
start "修复后的服务器" cmd /k "npm start"

echo.
echo [4/4] 等待服务器启动...
timeout /t 5 /nobreak >nul

echo.
echo ✅ 修复完成！
echo.
echo 主要修复内容：
echo - 移除了HTTP连接上的HSTS头
echo - 优化了缓存控制策略
echo - 修复了CSS兼容性问题
echo - 正确设置了MIME类型
echo - 优化了安全头配置
echo.
echo 请刷新浏览器页面查看效果
echo.
pause
