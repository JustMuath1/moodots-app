#!/bin/zsh
# Nuqta — one-click update.
# Double-click this from Terminal. It pulls the latest code, rebuilds the dashboard,
# refreshes Python packages, and starts the server. Your personal files (recipes,
# config, database, keys) are never touched — they're git-ignored.
cd "$(dirname "$0")"

say() { print -P "%F{cyan}▸ $1%f"; }
ok()  { print -P "%F{green}✓ $1%f"; }
err() { print -P "%F{red}✗ $1%f"; }

say "Nuqta update starting…"

# 1. Pull the latest code (only if this is a git checkout with a remote).
if [[ -d .git ]] && git remote get-url origin >/dev/null 2>&1; then
  say "Fetching the latest version…"
  # Stash nothing: personal files are git-ignored, tracked files shouldn't be edited by hand.
  if git pull --ff-only; then
    ok "Code updated."
  else
    err "Couldn't fast-forward (you may have local edits). Run 'git status' to see what changed."
    err "Continuing with the code you already have."
  fi
else
  say "No git remote set — skipping code download, rebuilding what's here."
fi

# 2. If a Pro license is present, refresh the Pro add-ons from the licensed server.
if [[ -f nuqta_license.json ]]; then
  say "Pro license found — refreshing Pro add-ons…"
  if python3 pro_update.py 2>/dev/null; then
    ok "Pro add-ons up to date."
  else
    err "Couldn't refresh Pro add-ons (will retry next update). The base app still runs."
  fi
fi

# 3. Keep Python packages current.
say "Checking Python packages…"
pip3 install --quiet --upgrade bleak aiohttp certifi fauxmo 2>/dev/null && ok "Packages ready."

# 4. Rebuild the dashboard.
say "Building the dashboard…"
if (cd frontend && npm install --silent && npm run build --silent); then
  ok "Dashboard built."
else
  err "Build failed — check the messages above. The old dashboard still works."
fi

# 5. Start the server (replaces any server already running).
ok "Update complete. Starting Nuqta…"
sleep 1
exec ./start-nuqta.command
