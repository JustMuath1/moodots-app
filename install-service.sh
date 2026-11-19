#!/usr/bin/env bash
# Start moodots automatically at boot on Linux (e.g. a Raspberry Pi) and keep it running.
# Run once, after install.sh:   bash install-service.sh
# Undo:                         bash install-service.sh --remove
# Older versions installed the same server as "nuqta.service"; this replaces it with
# "moodots.service" so only one copy ever runs on port 8420.
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
UNIT=/etc/systemd/system/moodots.service
OLD_UNIT=/etc/systemd/system/nuqta.service

remove_old() {
  if [ -e "$OLD_UNIT" ] || systemctl list-unit-files nuqta.service 2>/dev/null | grep -q '^nuqta\.service'; then
    sudo systemctl disable --now nuqta 2>/dev/null || true
    sudo rm -f "$OLD_UNIT"
    echo "Removed the old nuqta service (replaced by moodots)."
  fi
}

if [ "$1" = "--remove" ]; then
  sudo systemctl disable --now moodots 2>/dev/null || true
  sudo rm -f "$UNIT"
  remove_old
  sudo systemctl daemon-reload
  echo "Removed — moodots no longer starts at boot."
  exit 0
fi

[ -x .venv/bin/python ] || { echo "Run 'bash install.sh' first, then run this again."; exit 1; }
command -v systemctl >/dev/null || { echo "This needs systemd (Raspberry Pi OS, Ubuntu, Debian…)."; exit 1; }

# The old service would fight the new one over port 8420: stop and remove it first.
remove_old

# Stop a copy started by hand, so the service owns port 8420.
old=$(lsof -tiTCP:8420 -sTCP:LISTEN 2>/dev/null || true)
[ -n "$old" ] && kill "$old" 2>/dev/null || true

sudo tee "$UNIT" >/dev/null <<UNITEOF
[Unit]
Description=moodots — dashboard for the xBloom coffee machine
After=network-online.target bluetooth.target
Wants=network-online.target bluetooth.target

[Service]
User=$USER
WorkingDirectory=$DIR
ExecStart=$DIR/.venv/bin/python server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITEOF

sudo systemctl daemon-reload
sudo systemctl enable --now moodots
sleep 3
if systemctl is-active --quiet moodots; then
  echo "✓ moodots is running and will start by itself after every reboot."
  echo "  Open http://$(hostname).local:8420  or  http://$(hostname -I 2>/dev/null | awk '{print $1}'):8420"
  echo "  Restart: sudo systemctl restart moodots · Logs: journalctl -u moodots -f"
else
  echo "✗ The service didn't start. See why with: journalctl -u moodots -n 50"
  exit 1
fi
