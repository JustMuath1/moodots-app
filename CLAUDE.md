# Setting up Nuqta with Claude Code

You are helping someone run **Nuqta**, a local dashboard that controls an **xBloom** coffee
machine over Bluetooth from their Mac. Everything runs on their machine; nothing is sent to a
server you don't control. Walk them through setup, running one command at a time and confirming
each step before the next.

## What they need first
- A **Mac** (the server talks to the machine over Bluetooth; macOS must grant Bluetooth to Terminal).
- **Python 3.10+** (`python3 --version`) and **Node.js 18+** (`node --version`). If missing, point
  them to python.org and nodejs.org, or `brew install python node`.
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

4. **Run the server.** It must run from **Terminal.app** so macOS gives it Bluetooth permission:
   ```
   open -a Terminal start-nuqta.command
   ```
   The first run triggers a macOS Bluetooth permission prompt — they must click **Allow**.
   The Terminal window prints the addresses to open.

5. **Open the dashboard.** On the Mac: `http://localhost:8420`. On a phone/tablet on the same
   Wi-Fi: the `http://<Mac-IP>:8420` address printed in the Terminal. The machine connects over
   Bluetooth automatically; it appears as "connected" in the header.

## Optional: sync recipes from their xBloom account
Copy `xbloom_config.example.json` to `xbloom_config.json` and fill in their xBloom email and
password. This file is git-ignored and stays on their Mac. Without it, a few starter recipes are
built in and the machine is still fully controllable.

## Troubleshooting
- **"not connected":** the server must run from Terminal.app with Bluetooth allowed (System
  Settings → Privacy & Security → Bluetooth → Terminal). The machine must be on and awake.
- **Port 8420 in use:** `start-nuqta.command` stops any old server first; if it persists,
  `lsof -tiTCP:8420 | xargs kill`.
- **Rebuild after changing the frontend:** `cd frontend && npm run build`.

Do not commit `xbloom_config.json`, `nuqta.db`, or anything under the git-ignore list — those hold
personal data.
