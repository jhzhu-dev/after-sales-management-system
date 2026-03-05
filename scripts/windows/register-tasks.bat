@echo off
REM =============================================================
REM register-tasks.bat
REM 以管理员身份运行此文件，注册数据库备份计划任务
REM 右键 → "以管理员身份运行"
REM =============================================================
echo.
echo === 注册设备管理系统备份计划任务 ===
echo.

REM 写入 NAS 凭据到 Windows 凭据管理器
echo [1/3] 写入 NAS 凭据...
cmdkey /add:elsvision /user:jhzhu /pass:Zhujiahao123
echo.

REM 注册数据库备份任务（每日 01:00，以 SYSTEM 身份运行 docker exec）
echo [2/3] 注册备份任务 DeviceManager-DBBackup（每日 01:00）...
schtasks /create /tn "DeviceManager-DBBackup" /sc DAILY /st 01:00 /ru SYSTEM /rl HIGHEST /f ^
  /tr "\"C:\Windows\System32\cmd.exe\" /c docker exec device-manager-db-backup /bin/bash /backup.sh >> D:\py_project\manger\backups\backup.log 2>&1"
echo.

REM 注册 NAS 同步任务（每日 02:00，以 SYSTEM 身份运行 backup.ps1）
echo [3/3] 注册同步任务 DeviceManager-NASSync（每日 02:00）...
schtasks /create /tn "DeviceManager-NASSync" /sc DAILY /st 02:00 /ru SYSTEM /rl HIGHEST /f ^
  /tr "powershell.exe -NonInteractive -ExecutionPolicy Bypass -File \"D:\py_project\manger\backup.ps1\""
echo.

REM 确认注册结果
echo === 注册结果 ===
schtasks /query /tn "DeviceManager-DBBackup" /fo LIST 2>nul || echo DeviceManager-DBBackup: 注册失败
schtasks /query /tn "DeviceManager-NASSync"  /fo LIST 2>nul || echo DeviceManager-NASSync:  注册失败

echo.
echo === 完成 ===
echo 验证：打开"任务计划程序" → 查找 DeviceManager-DBBackup 和 DeviceManager-NASSync
echo.
pause
