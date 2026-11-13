#!/usr/bin/env bash
# Nuqta installer for Linux — run:  bash install.sh
# Sets up a private Python environment (.venv) in this folder, installs the
# packages, builds the dashboard, then offers to start Nuqta.
cd "$(dirname "$0")"
ok()   { printf '\033[32m✓ %s\033[0m\n' "$1"; }
step() { printf '\033[36m▸ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

step "Checking Python and Node.js…"
command -v python3 >/dev/null || fail "Python 3 isn't installed (e.g. sudo apt install python3 python3-venv)."
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || fail "Python 3.10 or newer is needed (you have $(python3 -V 2>&1))."
command -v npm >/dev/null || fail "Node.js isn't installed (https://nodejs.org, or your package manager)."
ok "$(python3 -V), Node $(node -v)"

step "Installing Python packages (into .venv in this folder)…"
python3 -m venv .venv || fail "Couldn't create the Python environment — on Debian/Ubuntu: sudo apt install python3-venv"
.venv/bin/python -m pip install -q --upgrade pip >/dev/null 2>&1
.venv/bin/python -m pip install -q -r requirements.txt || fail "Couldn't install the Python packages."
ok "Python packages installed."

step "Building the dashboard…"
(cd frontend && npm install --silent && npm run build --silent) || fail "The dashboard build failed — see the messages above."
ok "Dashboard built."

echo
ok "Nuqta is installed. Start it any time with: ./start-nuqta.sh"
[ -n "$NUQTA_NO_START" ] && exit 0   # set by Claude Code / scripts: install only
read -r -p "Start Nuqta now? [Y/n] " reply
case "$reply" in [nN]*) exit 0 ;; esac
exec ./start-nuqta.sh
