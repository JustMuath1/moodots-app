@echo off
REM Starts the moodots / xBloom server on Windows.
REM Double-click this file, or run it from a Command Prompt / PowerShell window.
REM Only one server runs at a time: starting this replaces any moodots server already running.
REM
REM Needs Windows 10 1809+ (bleak uses the WinRT Bluetooth LE APIs) and Python
REM 3.10+ on PATH as "python". Make sure Bluetooth is turned on in Settings.
REM This script doesn't change your Windows power/sleep settings.

cd /d "%~dp0"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8420" ^| findstr "LISTENING"') do (
    echo Stopping the moodots server already running (PID %%p)...
    taskkill /PID %%p /F >nul 2>&1
)

REM Use the private environment from install.bat when it exists.
set "PY=python"
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
echo moodots server starting (Ctrl+C to stop)
%PY% server.py
pause
