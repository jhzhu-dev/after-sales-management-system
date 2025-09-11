@echo off
chcp 65001 >nul
mode con cols=80 lines=25

echo.
echo ========================================
echo       清除浏览器缓存和HSTS设置
echo ========================================
echo.

echo 请按照以下步骤操作：
echo.
echo 1. 打开浏览器，访问以下地址：
echo    Chrome: chrome://net-internals/#hsts
echo    Edge:   edge://net-internals/#hsts
echo.
echo 2. 在 "Delete domain security policies" 中输入：
echo    192.168.0.136
echo.
echo 3. 点击 "Delete" 按钮
echo.
echo 4. 清除浏览器缓存：
echo    - 按 Ctrl+Shift+Delete
echo    - 选择"所有时间"
echo    - 勾选所有选项
echo    - 点击"清除数据"
echo.
echo 5. 重启浏览器
echo.
echo 6. 访问: http://192.168.0.136:5000
echo.
pause
