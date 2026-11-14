<p align="center">
  <img src="docs/brand/nuqta-mark.svg" width="96" alt="Nuqta logo">
  &nbsp;
  <img src="docs/brand/nuqta-wordmark.svg" height="64" alt="نُقطة">
</p>

<h1 align="center">نُقطة · Nuqta</h1>
<p align="center"><b>A dot‑matrix dashboard that controls your xBloom coffee machine</b><br>
Arabic first · tablet, iPad, phone and desktop · themes · Saudi standby scenes · runs at home, free</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#install-with-claude-code-no-technical-steps">Install with Claude Code</a> ·
  <a href="#raspberry-pi--an-alwayson-host-no-mac-needed">Raspberry Pi</a> ·
  <a href="https://hub.nuqtasa.tools/install">دليل التثبيت بالعربية</a> ·
  <a href="#nuqta-pro">Nuqta Pro</a> ·
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

Nuqta turns a spare tablet, phone or screen into a controller for an **xBloom** coffee machine. A
computer near the machine (Mac, Windows or Linux) talks to it over Bluetooth and serves a live
dashboard to every screen on your home Wi‑Fi. It's free and open source, and everything runs on your
own computer — no account needed.

> Unofficial and not affiliated with xBloom. It uses a reverse‑engineered Bluetooth interface that
> may change at any time.

<p align="center"><img src="docs/screenshots/tablet-home.png" width="860" alt="Nuqta home on a tablet"></p>

## What it does
- **One‑tap brew** of any recipe, with pause, resume and stop.
- **Live dot‑matrix animation** for every stage — grinding, heating, each pour, the cup filling.
- **Brew timeline** showing each step's amount, temperature and wait.
- **Modes:** grind only, water only (temperature · amount · pour pattern), and scale only.
- **Water tank** card that tracks the level and warns when it's low.
- **Recipes and schedules** — wake up to a fresh cup.
- **Customisable home** per device, **4 themes** that recolour everything, **3 standby** scenes —
  more with [Nuqta Pro](#nuqta-pro).
- **Arabic and English**, with Gregorian and Hijri dates.
- **Alexa (optional):** "Alexa, turn on coffee" — see [Voice control](#voice-control-alexa).

<p align="center">
  <img src="docs/screenshots/phone.png" width="240" alt="Nuqta on a phone">
  &nbsp;
  <img src="docs/screenshots/theme-saudi.png" width="560" alt="Saudi theme">
</p>

## Install

### What you need
- A **computer with Bluetooth** that stays near the xBloom: **macOS**, **Windows 10 (1809+)**, or
  **Linux**. macOS is the best‑tested; Windows and Linux are supported but newer.
- **Python 3.10 or newer** — [python.org/downloads](https://www.python.org/downloads/)
  (on Windows, tick **"Add python.exe to PATH"** during setup).
- **Node.js 20.19 or newer** (the LTS version) — [nodejs.org](https://nodejs.org). Nuqta runs on
  Node 18, but voice control needs 20.19 or newer.
- Your **xBloom** turned on.

### 1. Download
```bash
git clone https://github.com/JustMuath1/nuqta-app.git
```
```bash
cd nuqta-app
```
No Git? Use **Code → Download ZIP** on this page and unzip it.

### 2. Run the installer
It creates a private Python environment inside the folder, installs everything, builds the dashboard
and starts Nuqta. Nothing is installed system‑wide.

| Your computer | Do this |
|---|---|
| **macOS** | Double‑click **`install.command`** (or in Terminal: `cd` into the folder, then `zsh install.command`) |
| **Windows** | Double‑click **`install.bat`** |
| **Linux** | Run `bash install.sh` |

> The folder is **`nuqta-app-master`** (in Downloads) if you used the ZIP, or **`nuqta-app`** if you used Git.
> In Terminal, type `cd ` (with a space) and drag the folder into the window to go there.

> **macOS says the file "can't be opened"?** That happens with the ZIP download. Right‑click
> `install.command` → **Open** → **Open**, or run `zsh install.command` in Terminal from that folder.

### 3. Open the dashboard
- On the first start, **macOS asks for Bluetooth permission — click Allow.**
- On the same computer open **http://localhost:8420**.
- On a phone or tablet on the same Wi‑Fi, open the **`http://<your-computer's-IP>:8420`** address the
  window prints. In Safari, **Share → Add to Home Screen** makes it look like an app.
- Turn the xBloom on — it connects by itself.

**Starting it next time:** `start-nuqta.command` (macOS), `start-nuqta.bat` (Windows), or
`./start-nuqta.sh` (Linux). Keep that window open while you use Nuqta.

## Raspberry Pi — an always‑on host, no Mac needed
A **Raspberry Pi** placed near the xBloom can run Nuqta 24/7 on very little power. Your tablets and
phones (Android included) open the dashboard from it. An Android tablet can't be the host itself:
Android doesn't let ordinary apps use the Bluetooth access Nuqta needs — but it works fully as a
screen.

### What you need
- **Raspberry Pi 4 or 5** (2 GB RAM or more) — they have Bluetooth and Wi‑Fi built in. A Pi 3B+ or
  Zero 2 W also has Bluetooth but builds slowly.
- Its power supply and a **microSD card** (16 GB+).
- A computer to prepare the card.

### 1. Prepare the card
1. Install **[Raspberry Pi Imager](https://www.raspberrypi.com/software/)** on your computer.
2. Choose your Pi model, **Raspberry Pi OS (64‑bit)** (Lite is enough), and the microSD card.
3. When it asks to customise settings, set:
   - hostname **`nuqta`**
   - a username and password
   - your **Wi‑Fi** name and password
   - under Services, **enable SSH**
4. Write the card, put it in the Pi, power it on near the xBloom and wait about 2 minutes.

### 2. Connect to it
From your computer's Terminal (Windows: PowerShell), using the username you chose:
```bash
ssh <username>@nuqta.local
```

### 3. Install Nuqta on the Pi
The current Raspberry Pi OS (13 Trixie) installs a Node new enough for voice control; the older one
(12 Bookworm) runs Nuqta without voice control.
```bash
sudo apt update && sudo apt install -y git python3-venv nodejs npm bluez lsof
```
```bash
git clone https://github.com/JustMuath1/nuqta-app.git && cd nuqta-app
```
```bash
NUQTA_NO_START=1 bash install.sh
```
Building the dashboard can take a couple of minutes on a Pi.

### 4. Start it automatically at every boot
```bash
bash install-service.sh
```
It prints the address to open — usually **http://nuqta.local:8420**. On Android, open it in
Chrome → menu → **Add to Home screen**. (If `nuqta.local` doesn't open on Android, use the IP
address it printed.)

**Day to day:** restart with `sudo systemctl restart nuqta`, watch the log with
`journalctl -u nuqta -f`. **Update:** `cd nuqta-app && git pull && NUQTA_NO_START=1 bash
install.sh && sudo systemctl restart nuqta`. **Turn off auto‑start:** `bash install-service.sh
--remove`.

## Install with Claude Code (no technical steps)
[Claude Code](https://code.claude.com/docs/en/overview) can do the whole install for you: it
downloads Nuqta, checks what's missing, runs the installer and starts it, explaining each step.
You need a **paid Claude plan (Pro or higher)** — the free plan doesn't include Claude Code.

### Option A — Claude desktop app (no terminal)
1. Download the **Claude** app from [claude.com/download](https://claude.com/download) and sign in.
2. Open the **Code** tab, then choose a folder for Nuqta to live in (for example *Documents*):
   click the folder control under the prompt box → **Open folder…**.
3. Paste this and press Enter:
   > **Download Nuqta from https://github.com/JustMuath1/nuqta-app and set it up for my xBloom.**

   بالعربي:
   > **حمّل نقطة من https://github.com/JustMuath1/nuqta-app وجهّزها لآلة xBloom عندي.**

### Option B — Claude Code in the terminal
1. Install Claude Code:

   | Your computer | Run this |
   |---|---|
   | **macOS / Linux** | `curl -fsSL https://claude.ai/install.sh \| bash` |
   | **Windows** (PowerShell) | `irm https://claude.ai/install.ps1 \| iex` |

   Then open a **new** terminal window. (Homebrew: `brew install --cask claude-code` ·
   WinGet: `winget install Anthropic.ClaudeCode`.)
2. Go to a folder for Nuqta and start Claude:
   ```bash
   cd ~/Documents
   ```
   ```bash
   claude
   ```
   The first time, it opens your browser to sign in.
3. Paste the same message as in Option A.

### What happens next
- Claude checks for **Python** and **Node.js**. If one is missing it tells you exactly what to
  install, then carries on.
- It asks your permission before running commands — read each one and approve it.
- It runs the installer and opens Nuqta in its own window. **On a Mac, click Allow when macOS asks
  for Bluetooth.**
- It gives you the address to open on your phone.

**Later, just ask Claude** in the same folder: *"update Nuqta"*, *"my phone can't open the
dashboard"*, *"add my xBloom recipes"*, or *"start Nuqta"*. It follows the instructions in
[`CLAUDE.md`](CLAUDE.md).

## Optional extras
- **Your own xBloom recipes:** copy `xbloom_config.example.json` to `xbloom_config.json` and add your
  xBloom email and password. The file stays on your computer (it's git‑ignored). Without it, a few
  starter recipes are built in.
- **Fonts:** the UI prefers the licensed **Thmanyah** font and falls back to IBM Plex Sans Arabic.
  To use Thmanyah, put its `.woff2`/`.otf` files in a `fonts/` folder.

## Voice control (Alexa)
Nuqta shows up in the Alexa app as a set of on/off devices (Coffee, Coffee Pause, Hot Water,
Grinder, Scale, Coffee Machine). It works on your home Wi‑Fi with any Echo that supports Matter
(most Echo devices from 2019 on); no Alexa skill and no account are needed.

1. In Nuqta, tap the microphone button in the top bar and turn **Voice control** on. With Nuqta
   Pro you first pick what Alexa gets on the **Devices** tab, then press **Send to Alexa**.
2. In the Alexa app: **Devices → + → Add Device → Matter**, then scan the QR code shown on the
   Voice page or type its setup code.
3. Say **"Alexa, turn on coffee"**. The dashboard follows along on screen.

Device names are in English, so speak to Alexa in
English. The installer sets up the voice add‑on; if the Voice page says it is missing, run the
installer again (it needs Node.js) and restart Nuqta.

**Apple Home and Google Home** can pair with the same setup code, but this is **not tested yet**,
and each needs its own hub (Apple TV or HomePod; a Nest speaker, Nest Hub or Google TV Streamer).

## Nuqta Pro
The app is complete and free on your home Wi‑Fi. **Nuqta Pro** unlocks the rest:

<p align="center"><img src="docs/brand/pro-analytics.png" width="860" alt="Nuqta Pro brew analytics"></p>

- **Brew analytics** — how much and when you brew, top recipes, dose and ratio consistency,
  ratings, water, cost per cup and beans used.
- **Every theme** — Saudi, Riyadh, Dammam, Al‑Baha, Ramadan and Neon, on top of the four free ones.
- **Every standby scene** — Dalla and finjan, Palm, Riyadh, Dammam and Al‑Baha.
- **Voice control page** — voice names for your recipes with Alexa, Siri and NFC shortcuts,
  safety options and a command log. (Basic Alexa control stays free.)
- **Device notifications** — a "coffee ready" alert on your phone or tablet, even when Nuqta is
  closed.
- **Feature updates, automatically** — new Pro features arrive on their own.
- **Nuqta Cloud** (included): open Nuqta from anywhere and get "coffee ready" alerts on your phone.

**49 SAR, paid once, for life** — no subscription. Request it at
**[hub.nuqtasa.tools](https://hub.nuqtasa.tools)**. Online payment isn't live yet, so we contact you to
pay; then a "Nuqta Pro is active" email arrives. In the app open **Settings → Nuqta Pro**, sign in
with the same email and enter the 6‑digit code that's emailed to you.

## Updating
**Installed with Git:** double‑click **`nuqta-update.command`** (macOS). It downloads the latest
version, updates packages, rebuilds and restarts — your recipes, settings and history are kept. On
Windows or Linux, inside the Nuqta folder:
```bash
git pull
```
then run the installer again.

**Installed from the ZIP:** download the new ZIP, copy every `.json` and `.db` file (your settings,
recipes and history) and the `matter_data` folder, if there is one, from the old folder into the new
one, then run the installer. (`nuqta-update.command` can't download anything for a ZIP install.)

With Claude Code, just say **"update Nuqta"**.

## Troubleshooting
- **"Disconnected" / can't find the machine:** keep the computer within Bluetooth range and the
  xBloom on. On macOS, check **System Settings → Privacy & Security → Bluetooth** allows Terminal.
  On Linux, make sure Bluetooth is on (`sudo systemctl enable --now bluetooth`).
- **Phone can't open the address:** it must be on the same Wi‑Fi as the computer, and the computer's
  firewall must allow incoming connections for Python.
- **"Port 8420 in use":** the start scripts stop an old Nuqta first; if it persists, restart the
  computer or close the other program using that port.
- **Installer says Python or Node is missing:** install them from the links above, then run the
  installer again.
- **Something else:** [open an issue](https://github.com/JustMuath1/nuqta-app/issues) with what you
  see in the Nuqta window.

## Privacy
Everything runs on your computer. Nuqta only talks to the internet to sync recipes from your xBloom
account (if you add it) and, if you sign in to Nuqta Pro, to `hub.nuqtasa.tools`.

## Security
Nuqta is made for your home network: anyone on your Wi‑Fi can open the dashboard, and there is no
password. Don't expose port 8420 to the internet (no port forwarding). Your xBloom sign‑in and Nuqta
account tokens are stored only on your computer, in files only your user can read.

## License
MIT — see [LICENSE](LICENSE). Not affiliated with xBloom; "xBloom" is a trademark of its owner.
