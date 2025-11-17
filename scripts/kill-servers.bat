@echo off
setlocal
set SCRIPT_DIR=%~dp0

:: If no args, use default ports inside the PowerShell script.
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%kill-servers.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%kill-servers.ps1" -Ports %*
)

endlocal
