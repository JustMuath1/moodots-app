@echo off
REM Nuqta installer for Windows - double-click it.
REM Sets up a private Python environment (.venv) in this folder, installs the
REM packages, builds the dashboard, then starts Nuqta.
cd /d "%~dp0"

echo Checking Python and Node.js...
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY goto :nopython
where npm >nul 2>&1 || goto :nonode

echo Installing Python packages (into .venv in this folder)...
%PY% -m venv .venv || goto :failvenv
.venv\Scripts\python -m pip install -q --upgrade pip >nul 2>&1
.venv\Scripts\python -m pip install -q -r requirements.txt || goto :failpip

echo Building the dashboard...
pushd frontend
call npm install --silent || goto :failbuild
call npm run build --silent || goto :failbuild
popd

echo.
echo Nuqta is installed. Next time, start it by double-clicking start-nuqta.bat
REM NUQTA_NO_START is set by Claude Code / scripts: install only, don't start.
if defined NUQTA_NO_START exit /b 0
call start-nuqta.bat
exit /b 0

:nopython
echo Python 3.10 or newer is not installed. Get it from https://www.python.org/downloads/
echo (tick "Add python.exe to PATH" during setup), then run this again.
pause
exit /b 1

:nonode
echo Node.js is not installed. Get the LTS version from https://nodejs.org, then run this again.
pause
exit /b 1

:failvenv
echo Could not create the Python environment.
pause
exit /b 1

:failpip
echo Could not install the Python packages. Check your internet connection and try again.
pause
exit /b 1

:failbuild
popd
echo The dashboard build failed. See the messages above.
pause
exit /b 1
