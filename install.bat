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
node -e "process.exit(+process.versions.node.split('.')[0]>=18?0:1)" || goto :oldnode

echo Installing Python packages (into .venv in this folder)...
%PY% -m venv .venv || goto :failvenv
.venv\Scripts\python -m pip install -q --upgrade pip >nul 2>&1
.venv\Scripts\python -m pip install -q -r requirements.txt || goto :failpip

echo Building the dashboard...
pushd frontend
call npm install --silent || goto :failbuild
call npm run build --silent || goto :failbuild
popd

echo Setting up voice control...
node -e "const[a,b]=process.versions.node.split('.').map(Number);process.exit(a>=23||(a===22&&b>=13)||(a===20&&b>=19)?0:1)" || goto :novoice
pushd matter
call npm install --silent --no-audit --no-fund || echo Voice control could not be installed - the rest of Nuqta works.
popd
:aftervoice

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

:oldnode
echo Node.js 18 or newer is needed. Get the LTS version from https://nodejs.org, then run this again.
pause
exit /b 1

:novoice
echo Voice control (Alexa / Apple Home / Google Home) needs Node.js 20.19 or newer. Skipped - the rest of Nuqta works.
echo Update Node from https://nodejs.org and run this again to add it.
goto :aftervoice

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
