#!/usr/bin/env bash
# Start Nuqta automatically at boot on Linux (e.g. a Raspberry Pi) and keep it running.
# Run once, after install.sh:   bash install-service.sh
# Undo:                         bash install-service.sh --remove
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
UNIT=/etc/systemd/system/nuqta.service

if [ "$1" = "--remove" ]; then
  sudo systemctl disable --now nuqta 2>/dev/null || true
  sudo rm -f "$UNIT"
  sudo systemctl daemon-reload
  echo "Removed — Nuqta no longer starts at boot."
  exit 0
fi

[ -x .venv/bin/python ] || { echo "Run 'bash install.sh' first, then run this again."; exit 1; }
command -v systemctl >/dev/null || { echo "This needs systemd (Raspberry Pi OS, Ubuntu, Debian…)."; exit 1; }

# Stop a copy started by hand, so the service owns port 8420.
old=$(lsof -tiTCP:8420 -sTCP:LISTEN 2>/dev/null || true)
[ -n "$old" ] && kill "$old" 2>/dev/null || true

sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=Nuqta — dashboard for the xBloom coffee machine
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
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now nuqta
sleep 3
if systemctl is-active --quiet nuqta; then
  echo "✓ Nuqta is running and will start by itself after every reboot."
  echo "  Open http://$(hostname).local:8420  or  http://$(hostname -I 2>/dev/null | awk '{print $1}'):8420"
  echo "  Restart: sudo systemctl restart nuqta · Logs: journalctl -u nuqta -f"
else
  echo "✗ The service didn't start. See why with: journalctl -u nuqta -n 50"
  exit 1
fi
