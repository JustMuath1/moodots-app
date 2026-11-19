#!/bin/zsh
# Starts the moodots / xBloom server and keeps the Mac awake while it runs.
# Run it from Terminal (double-click this file): Terminal has the Bluetooth permission the server needs.
# Only one server runs at a time: starting this replaces any moodots server already running.
# caffeinate -i (no idle sleep) -m (no disk sleep) -s (no system sleep on power adapter) ends with the server.
# Closing the lid still sleeps the Mac unless you run once:  sudo pmset -a disablesleep 1
cd "$(dirname "$0")"

old=$(lsof -tiTCP:8420 -sTCP:LISTEN 2>/dev/null)
if [[ -n "$old" ]]; then
  echo "Stopping the moodots server already running (PID $old)…"
  kill $old 2>/dev/null
  # wait for the process itself to end (it can let go of the port but hang on Bluetooth shutdown)
  for i in {1..20}; do
    ps -p $old >/dev/null 2>&1 || break
    sleep 0.5
  done
  ps -p $old >/dev/null 2>&1 && kill -9 $old 2>/dev/null
  sleep 1
fi

# Use the private environment from install.command when it exists.
PY=python3; [[ -x .venv/bin/python ]] && PY=.venv/bin/python
echo "moodots server — keeping this Mac awake while it runs (Ctrl+C to stop)"
exec caffeinate -ims $PY server.py
