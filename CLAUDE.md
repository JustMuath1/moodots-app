# Setting up Nuqta with Claude Code

You are helping someone run **Nuqta**, a local dashboard that controls an **xBloom** coffee
machine over Bluetooth from their own computer. Everything runs on their machine; nothing is
sent to a server you don't control. Walk them through setup, running one command at a time and
confirming each step before the next. First, ask or detect which OS they're on — macOS,
Windows, or Linux — since step 4 differs.

## What they need first
- A computer with Bluetooth, near the machine: **macOS, Windows, or Linux**. macOS is the
  best-tested platform; Windows and Linux use the same Bluetooth library and are supported, but
  newer — if something doesn't work, say so plainly rather than guessing.
- **Python 3.10+** (`python3 --version`, or `python --version` on Windows) and **Node.js 18+**
  (`node --version`). If missing, point them to python.org and nodejs.org, or (macOS)
  `brew install python node`.
- An **xBloom machine** powered on and nearby.

## Steps
1. **Python packages** (in the project folder):
   ```
   pip3 install bleak aiohttp certifi fauxmo
   ```
   `fauxmo` is only needed for the optional Alexa control; skip it if they don't want that.

2. **Build the dashboard** (produces `dashboard.html`):
   ```
   cd frontend && npm install && npm run build && cd ..
   ```

3. **Fonts (optional).** The UI prefers the "Thmanyah" font but ships without it (it's licensed).
   It falls back to IBM Plex Sans Arabic automatically. To use Thmanyah, put the `.woff2`/`.otf`
   files in a `fonts/` folder in the project root.

4. **Run the server.** Pick the script for their OS:
   - **macOS** — must run from Terminal.app so macOS grants Bluetooth permission:
     ```
     open -a Terminal start-nuqta.command
     ```
     The first run triggers a macOS Bluetooth permission prompt — they must click **Allow**.
   - **Windows** — double-click `start-nuqta.bat`, or run it from a Command Prompt / PowerShell
     window. Needs Windows 10 1809+ and Bluetooth turned on in Settings.
   - **Linux** — `./start-nuqta.sh` (make it executable first: `chmod +x start-nuqta.sh`).
     Bluetooth goes through BlueZ; if it's off: `sudo systemctl enable --now bluetooth`.

   Each script prints the addresses to open.

5. **Open the dashboard.** On this computer: `http://localhost:8420`. On a phone/tablet on the
   same Wi-Fi: the `http://<this-computer's-IP>:8420` address printed by the script. The machine
   connects over Bluetooth automatically; it appears as "connected" in the header.

## Optional: sync recipes from their xBloom account
Copy `xbloom_config.example.json` to `xbloom_config.json` and fill in their xBloom email and
password. This file is git-ignored and stays on their machine. Without it, a few starter recipes
are built in and the machine is still fully controllable.

## Troubleshooting
- **"not connected":** on macOS, the server must run from Terminal.app with Bluetooth allowed
  (System Settings → Privacy & Security → Bluetooth → Terminal); on Windows/Linux, check
  Bluetooth is on at the OS level. The xBloom machine must be on and awake.
- **Port 8420 in use:** each start script stops any old server first; if it persists —
  macOS/Linux: `lsof -tiTCP:8420 | xargs kill`; Windows: `netstat -ano | findstr :8420` then
  `taskkill /PID <pid> /F`.
- **Rebuild after changing the frontend:** `cd frontend && npm run build`.

Do not commit `xbloom_config.json`, `nuqta.db`, or anything under the git-ignore list — those hold
personal data.
