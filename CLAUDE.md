# Setting up Nuqta with Claude Code

You are helping someone install and run **Nuqta**, a free dashboard that controls an **xBloom**
coffee machine over Bluetooth from their own computer. Many people asking are not developers:
explain each step in one plain sentence, run the commands yourself, and stop to ask only when they
must do something (install a program, click a permission prompt, turn the machine on).

Reply in the language they write in (Arabic or English).

## 1. Check what they have
Detect the OS first, then check:
- `python3 --version` (Windows: `py -3 --version` or `python --version`) — needs **3.10+**
- `node --version` — needs **18+**
- `git --version` — only needed if they want updates via git

If Python or Node is missing, tell them exactly what to install and wait:
- macOS: python.org/downloads and nodejs.org (LTS), or `brew install python node` if they use Homebrew
- Windows: python.org/downloads (tell them to tick **"Add python.exe to PATH"**) and nodejs.org (LTS)
- Linux: their package manager, e.g. `sudo apt install python3 python3-venv nodejs npm`

The computer must have Bluetooth and stay near the xBloom.

## 2. Get the code
If you're not already inside the `nuqta-app` folder, clone it and work from there:
```
git clone https://github.com/JustMuath1/nuqta-app.git
cd nuqta-app
```

## 3. Install
Run the installer for their OS with `NUQTA_NO_START=1` so it installs without starting the server
(you start it properly in step 4). It creates a private Python environment in `.venv`, installs
`requirements.txt`, and builds the dashboard. Nothing is installed system-wide — this also avoids
Homebrew Python's "externally managed environment" error.
- macOS: `NUQTA_NO_START=1 zsh install.command`
- Linux: `NUQTA_NO_START=1 bash install.sh`
- Windows (cmd): `set NUQTA_NO_START=1 && install.bat` — or in PowerShell:
  `$env:NUQTA_NO_START=1; .\install.bat`

It prints ✓ lines as it goes. If it stops with ✗, read the message — it says what's missing.

Manual fallback only if the installer can't run: `python3 -m venv .venv`, then
`.venv/bin/python -m pip install -r requirements.txt` (Windows: `.venv\Scripts\python`), then
`cd frontend && npm install && npm run build && cd ..`. `fauxmo` is only for optional Alexa control.

## 4. Start it
The server keeps running, so don't start it as a blocking command in your own shell — open it in
its own window:
- **macOS:** `open -a Terminal start-nuqta.command`. It must run from Terminal.app so macOS can
  grant Bluetooth. **Tell them a Bluetooth permission prompt will appear and they must click
  Allow.**
- **Windows:** `start "" start-nuqta.bat` (opens a new window). If Windows Firewall asks about
  Python, they should allow it on private networks.
- **Linux:** run `./start-nuqta.sh` in a separate terminal window, or in the background with its
  output logged to a file. If Bluetooth is off: `sudo systemctl enable --now bluetooth`.

Then confirm it's up: `curl -s localhost:8420/api/state` (or open http://localhost:8420).

## 5. Show them how to use it
- On this computer: **http://localhost:8420**
- On a phone or tablet on the same Wi-Fi: the `http://<this-computer's-IP>:8420` address the start
  window prints. In Safari: **Share → Add to Home Screen**.
- Turn the xBloom on — it connects by itself; the header shows "connected".
- Next time they only need the start script: `start-nuqta.command` (macOS), `start-nuqta.bat`
  (Windows), `./start-nuqta.sh` (Linux).

## Optional
- **Their own xBloom recipes:** copy `xbloom_config.example.json` to `xbloom_config.json` and have
  them type their xBloom email and password into it themselves (don't ask them to paste the
  password into chat). It's git-ignored and stays on their computer.
- **Fonts:** the UI prefers the licensed "Thmanyah" font and falls back to IBM Plex Sans Arabic. To
  use Thmanyah, put its `.woff2`/`.otf` files in a `fonts/` folder.
- **Nuqta Cloud** is **coming soon** (in development): use it away from home, "coffee ready"
  alerts on the phone, sync and backup. Launch price 49 SAR once, for life. If they ask, tell them
  it isn't available yet and they can save a spot at https://hub.nuqtasa.tools — don't promise
  these features work today.

## Updating
macOS: `zsh nuqta-update.command` (pulls, updates packages, rebuilds, restarts). Others: `git pull`,
then run the installer again (step 3) and restart (step 4). Their recipes, settings and history are
kept — they're in git-ignored files.

## Troubleshooting
- **"Disconnected":** machine on and in Bluetooth range? On macOS: System Settings → Privacy &
  Security → Bluetooth must allow Terminal, and the server must have been started from Terminal.app.
- **Phone can't open the address:** same Wi-Fi as the computer, and the computer's firewall must
  allow incoming connections for Python.
- **Port 8420 in use:** the start scripts stop an old Nuqta first. If it persists — macOS/Linux:
  `lsof -tiTCP:8420 | xargs kill`; Windows: `netstat -ano | findstr :8420`, then
  `taskkill /PID <pid> /F`.
- **`ModuleNotFoundError`:** packages aren't in the Python being used — run the installer again;
  the start scripts use `.venv` automatically.

Never commit `xbloom_config.json`, `nuqta.db`, `nuqta_cloud.json`, or anything else in
`.gitignore` — those hold personal data.
