#!/usr/bin/env bash
# Starts the moodots / xBloom server on Linux.
# Run from a terminal: ./start-moodots.sh (or: chmod +x start-moodots.sh first).
# Only one server runs at a time: starting this replaces any moodots server already running.
#
# Bluetooth on Linux goes through BlueZ. If scanning finds nothing, make sure
# Bluetooth is on and your user can access it:
#   sudo systemctl enable --now bluetooth
#   sudo usermod -aG bluetooth "$USER"   # then log out and back in
#
# This script doesn't touch your system's sleep settings. If the machine
# sleeps mid-brew, disable sleep while it runs with, e.g.:
#   systemd-inhibit --what=idle:sleep ./start-moodots.sh
cd "$(dirname "$0")"

# Installed as a boot service (install-service.sh)? Then systemd owns it — don't start a second copy.
# Older installs named the service "nuqta"; it is the same server.
if command -v systemctl >/dev/null; then
  for svc in moodots nuqta; do
    if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
      echo "moodots runs as a service on this machine (it starts at boot)."
      echo "Restart it with:  sudo systemctl restart $svc   ·   logs: journalctl -u $svc -f"
      exit 0
    fi
  done
fi

old=$(lsof -tiTCP:8420 -sTCP:LISTEN 2>/dev/null)
if [ -n "$old" ]; then
  echo "Stopping the moodots server already running (PID $old)…"
  kill "$old" 2>/dev/null
  for i in $(seq 1 20); do
    kill -0 "$old" 2>/dev/null || break
    sleep 0.5
  done
  kill -0 "$old" 2>/dev/null && kill -9 "$old" 2>/dev/null
  sleep 1
fi

# Use the private environment from install.sh when it exists.
PY=python3; [ -x .venv/bin/python ] && PY=.venv/bin/python
echo "moodots server starting (Ctrl+C to stop)"
exec "$PY" server.py
