#!/bin/zsh
# Nuqta installer for macOS — double-click it, or run:  zsh install.command
# Sets up a private Python environment (.venv) in this folder, installs the
# packages, builds the dashboard, then offers to start Nuqta.
cd "$(dirname "$0")"
ok()   { print -P "%F{green}✓ $1%f"; }
step() { print -P "%F{cyan}▸ $1%f"; }
fail() { print -P "%F{red}✗ $1%f"; print "Press Return to close."; read; exit 1; }

step "Checking Python and Node.js…"
command -v python3 >/dev/null || fail "Python 3 isn't installed. Get Python 3.10 or newer from https://www.python.org/downloads/ and run this again."
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || fail "Python 3.10 or newer is needed (you have $(python3 -V 2>&1)). Get it from https://www.python.org/downloads/"
command -v npm >/dev/null || fail "Node.js isn't installed. Get the LTS version from https://nodejs.org and run this again."
ok "$(python3 -V), Node $(node -v)"

step "Installing Python packages (into .venv in this folder)…"
python3 -m venv .venv || fail "Couldn't create the Python environment."
.venv/bin/python -m pip install -q --upgrade pip >/dev/null 2>&1
.venv/bin/python -m pip install -q -r requirements.txt || fail "Couldn't install the Python packages — check your internet connection and try again."
ok "Python packages installed."

step "Building the dashboard…"
(cd frontend && npm install --silent && npm run build --silent) || fail "The dashboard build failed — see the messages above."
ok "Dashboard built."

print ""
ok "Nuqta is installed."
print "Next time, start it by double-clicking start-nuqta.command."
[[ -n "$NUQTA_NO_START" ]] && exit 0   # set by Claude Code / scripts: install only
print -n "Start Nuqta now? [Y/n] "
read reply
[[ "$reply" == [nN]* ]] && exit 0
exec ./start-nuqta.command
