"""Nuqta Cloud — this app's client for the Nuqta Cloud hub (optional).

Off unless nuqta_cloud.json exists (git-ignored) with a hub_url and a
signed-in agent token. Nothing here ever talks to any server unless this
app was explicitly signed in to one — no phoning home by default. This is
shared, open code: the hub itself (and the paid features it gates) is
what's private, not the ability to talk to one.
"""
from __future__ import annotations

import json
import logging
import os
import socket
import time
from pathlib import Path

import ssl

import aiohttp

log = logging.getLogger("xbloom")

# The only hub this app talks to. It is fixed here (not taken from the browser
# or the saved file) so nothing on the network can point the app at another
# server. NUQTA_HUB_URL overrides it for development.
HUB_URL = os.environ.get("NUQTA_HUB_URL", "https://hub.nuqtasa.tools").rstrip("/")


def _write_private(path: Path, text: str) -> None:
    """Write a file only this user can read (it holds sign-in tokens)."""
    path.write_text(text)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass

# python.org's Python on macOS ships without system CA certificates, so plain
# HTTPS to the hub fails verification there. Use certifi's bundle (the main
# server already depends on it) and fall back to the system store elsewhere.
try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL = ssl.create_default_context()


def session() -> aiohttp.ClientSession:
    """An HTTP session that can verify the hub's HTTPS certificate on any OS."""
    # Ask for gzip only: Cloudflare otherwise Brotli-compresses larger responses,
    # and an installed Brotli package that's older or newer than aiohttp expects
    # makes every such response undecodable. gzip works everywhere.
    return aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=_SSL),
                                 headers={"Accept-Encoding": "gzip, deflate"})

CONFIG_FILE = Path(__file__).resolve().parent / "nuqta_cloud.json"
_ACCOUNT_CACHE_SECONDS = 60


def _device_label() -> str:
    try:
        return socket.gethostname()[:80]
    except Exception:
        return "Nuqta"


class HubClient:
    def __init__(self):
        self.hub_url = ""
        self.email = ""
        self.session_token = ""
        self.agent_token = ""
        self._account_cache: dict | None = None
        self._account_cache_at = 0.0
        self._load()

    def _load(self) -> None:
        if not CONFIG_FILE.exists():
            return
        try:
            d = json.loads(CONFIG_FILE.read_text())
            if (d.get("hub_url") or "").rstrip("/") != HUB_URL:
                log.warning("Saved Nuqta account is for a different server — signed out")
                return
            self.hub_url = HUB_URL
            self.email = d.get("email", "")
            self.session_token = d.get("session_token", "")
            self.agent_token = d.get("agent_token", "")
        except Exception as e:
            log.warning("Nuqta Cloud config unreadable (%s) — treating as signed out", e)

    def _save(self) -> None:
        try:
            _write_private(CONFIG_FILE, json.dumps({
                "hub_url": self.hub_url, "email": self.email,
                "session_token": self.session_token, "agent_token": self.agent_token,
            }))
        except Exception as e:
            log.warning("Nuqta Cloud config save failed: %s", e)

    @property
    def configured(self) -> bool:
        return bool(self.hub_url and self.agent_token)

    async def request_code(self, hub_url: str, email: str) -> dict:
        hub_url = HUB_URL
        try:
            async with session() as http:
                async with http.post(f"{hub_url}/auth/request-code", json={"email": email},
                                      timeout=aiohttp.ClientTimeout(total=10)) as r:
                    data = await r.json()
                    if r.status != 200:
                        return {"ok": False, "error": data.get("error", "request_failed")}
                    return {"ok": True}
        except Exception as e:
            log.warning("Nuqta Cloud request-code failed: %s", e)
            return {"ok": False, "error": "unreachable"}

    async def verify_code(self, hub_url: str, email: str, code: str) -> dict:
        hub_url = HUB_URL
        try:
            async with session() as http:
                async with http.post(f"{hub_url}/auth/verify", json={
                    "email": email, "code": code,
                    "want_agent_token": True, "label": _device_label(),
                }, timeout=aiohttp.ClientTimeout(total=10)) as r:
                    data = await r.json()
                    if r.status != 200:
                        return {"ok": False, "error": data.get("error", "verify_failed")}
        except Exception as e:
            log.warning("Nuqta Cloud verify failed: %s", e)
            return {"ok": False, "error": "unreachable"}

        self.hub_url = hub_url
        self.email = email
        self.session_token = data.get("session_token", "")
        self.agent_token = data.get("agent_token", "")
        self._save()
        self._account_cache = data.get("account")
        self._account_cache_at = time.time()
        return {"ok": True, "account": data.get("account")}

    def sign_out(self) -> None:
        self.hub_url = self.email = self.session_token = self.agent_token = ""
        self._account_cache = None
        try:
            CONFIG_FILE.unlink(missing_ok=True)
        except Exception:
            pass

    async def account_status(self, force: bool = False) -> dict:
        """Cached briefly so the dashboard (and the agent loop) can check
        cheaply and often. On a network blip, falls back to the last known
        status rather than flipping paid features off."""
        if not self.configured:
            return {"configured": False, "active": False}
        if not force and self._account_cache and (time.time() - self._account_cache_at) < _ACCOUNT_CACHE_SECONDS:
            return {"configured": True, **self._account_cache}
        try:
            async with session() as http:
                async with http.get(f"{self.hub_url}/account",
                                     headers={"Authorization": f"Bearer {self.agent_token}"},
                                     timeout=aiohttp.ClientTimeout(total=8)) as r:
                    if r.status == 200:
                        data = await r.json()
                        self._account_cache = data
                        self._account_cache_at = time.time()
                        return {"configured": True, **data}
        except Exception as e:
            log.warning("Nuqta Cloud account check failed: %s", e)
        if self._account_cache:
            return {"configured": True, **self._account_cache}
        return {"configured": True, "active": False, "error": "unreachable"}

    def agent_ws_url(self) -> str:
        scheme = "wss" if self.hub_url.startswith("https") else "ws"
        host = self.hub_url.split("://", 1)[-1]
        return f"{scheme}://{host}/agent?token={self.agent_token}"


hub = HubClient()
