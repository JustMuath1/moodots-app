#!/usr/bin/env python3
"""
xBloom Dashboard — BLE bridge server.

Connects to the xBloom Studio coffee machine over Bluetooth LE, serves a web
dashboard on a local port, and relays live telemetry via WebSocket so any
device on the same Wi-Fi (iPad, iPhone, laptop) can monitor and control the
machine from a browser.

Protocol ported from Xbloom-panel (MIT) / xbloom-py (MIT).
"""

import asyncio
import hashlib
import base64
import json
import logging
import math
import re
import os
import ssl
import struct
import sys
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

import certifi

import aiohttp
from aiohttp import web
import bleak
from cryptography.hazmat.primitives.asymmetric import padding as rsa_padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key

import hub_client
from html import escape as html_escape

log = logging.getLogger("xbloom")
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(name)s  %(message)s")

# ---------------------------------------------------------------------------
# BLE constants (from xbloom_protocol.h)
# ---------------------------------------------------------------------------
UUID_TX = "0000ffe1-0000-1000-8000-00805f9b34fb"
UUID_RX = "0000ffe2-0000-1000-8000-00805f9b34fb"
NAME_PREFIX = "XBLOOM"
PREFERRED_MACHINE = os.environ.get("XBLOOM_NAME", "")  # the machine picked in the app is saved to xbloom_config.json
# Machine picked in the dashboard (persisted in xbloom_config.json); when set,
# the connect loop only connects to this machine instead of falling back to any xBloom.
preferred_machine = PREFERRED_MACHINE
machine_chosen = False

# Command codes (host -> machine)
CMD_HANDSHAKE     = 8100
CMD_BYPASS_DOSE   = 8102
CMD_SET_CUP       = 8104
CMD_RECIPE_GRIND  = 8001
CMD_RECIPE_NO_GRIND = 8004
GRIND_SKIP        = 0xFE   # grind byte meaning "no grinder" (pre-ground)
CMD_EXECUTE       = 8002
CMD_QUIT_RECIPE   = 8017
CMD_TARE          = 8500
CMD_BREW_PAUSE    = 40518
CMD_BREW_RESUME   = 40524
CMD_BREW_STOP     = 40519

# Notification codes (machine -> host)
N_ACTIVITY      = 8023
N_WEIGHT        = 20501
N_WEIGHT_ALT    = 10507
N_WATER         = 40523
N_BLOOM         = 40510
N_ENJOY         = 40512
N_ABANDONED     = 40513
N_MACHINE_INFO  = 40521
N_SLEEPING      = 8009
N_AWAKE         = 8011
N_PODS          = 40501
N_FAULT_NO_WATER  = 40522
N_FAULT_NO_BEANS  = 40517
N_FAULT_DOSE_WATER = 8204
N_FAULT_GEAR      = 8203

# Manual module command codes
CMD_GRINDER_ENTER = 8006
CMD_GRINDER_START = 3500
CMD_GRINDER_STOP  = 3505
CMD_BREWER_ENTER  = 8007
CMD_BREWER_START  = 4506
CMD_BREWER_PAUSE  = 8019
CMD_BREWER_RESUME = 8021
CMD_BREWER_STOP   = 4507
CMD_BREWER_TEMP   = 4510
CMD_BREWER_PATTERN = 8016
CMD_SCALE_ENTER   = 8003
CMD_QUIT_GRINDER  = 8012
CMD_QUIT_BREWER   = 8013
CMD_QUIT_SCALE    = 8014
CMD_WEIGHT_UNIT   = 8005

# Patterns: API -> wire byte
PAT_CENTERED = 1
PAT_SPIRAL   = 2
PAT_CIRCULAR = 3

ACTIVITY_NAMES = {
    1: "Home", 3: "Brewer", 65: "Auto", 4: "Scale", 5: "Scale",
    29: "Starting", 34: "Grinding", 30: "Brewing", 35: "Brewing",
    16: "Brewing", 31: "Paused", 36: "Done",
}

FAULT_NAMES = {
    N_FAULT_NO_WATER: "Out of water",
    N_FAULT_NO_BEANS: "No beans",
    N_FAULT_DOSE_WATER: "Dose/water error",
    N_FAULT_GEAR: "Grinder gear error",
}


# ---------------------------------------------------------------------------
# Protocol helpers
# ---------------------------------------------------------------------------
def shutil_which(name):
    import shutil
    return shutil.which(name)


def crc16_kermit(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0x8408 if crc & 1 else crc >> 1
    return crc & 0xFFFF


def build_frame(code: int, ints=None, raw=None, frame_type=1) -> bytes:
    body = b""
    if raw is not None:
        body = bytes(raw)
    elif ints:
        for v in ints:
            body += struct.pack("<I", v & 0xFFFFFFFF)
    f = bytearray()
    f.append(0x58)
    f.append(0x01)
    f.append(frame_type)
    f += struct.pack("<H", code)
    f += struct.pack("<I", 12 + len(body))
    f.append(0x01)
    f += body
    f += struct.pack("<H", crc16_kermit(bytes(f)))
    return bytes(f)


def float_bits(v: float) -> int:
    return struct.unpack("<I", struct.pack("<f", v))[0]


def pattern_to_byte(api_pat: int) -> int:
    return {PAT_CENTERED: 0, PAT_SPIRAL: 2, PAT_CIRCULAR: 1}.get(api_pat, 0)


def frame_code(f: bytes) -> int:
    if len(f) < 5 or f[0] != 0x58:
        return 0
    return f[3] | (f[4] << 8)


# Simple command frames
def frame_execute():      return build_frame(CMD_EXECUTE)
def frame_quit_recipe():  return build_frame(CMD_QUIT_RECIPE)
def frame_tare():         return build_frame(CMD_TARE)
def frame_pause():        return build_frame(CMD_BREW_PAUSE)
def frame_resume():       return build_frame(CMD_BREW_RESUME)
def frame_stop():         return build_frame(CMD_BREW_STOP)

# Manual module frames
def frame_grinder_enter(size, rpm):
    return build_frame(CMD_GRINDER_ENTER, [size, rpm])

def frame_grinder_start(size, rpm):
    return build_frame(CMD_GRINDER_START, [1000, size, rpm])

def frame_grinder_stop():
    return build_frame(CMD_GRINDER_STOP)

def frame_brewer_enter(pattern_byte, temp_c):
    return build_frame(CMD_BREWER_ENTER, [pattern_byte, float_bits(temp_c * 10)])

def frame_brewer_start(flow, volume_ml, temp_c, pattern_byte):
    return build_frame(CMD_BREWER_START, [
        float_bits(flow * 10), float_bits(volume_ml * 10),
        float_bits(temp_c * 10), 0, pattern_byte
    ])

def frame_brewer_stop():  return build_frame(CMD_BREWER_STOP)
def frame_scale_enter():  return build_frame(CMD_SCALE_ENTER)
def frame_quit_grinder(): return build_frame(CMD_QUIT_GRINDER)
def frame_quit_brewer():  return build_frame(CMD_QUIT_BREWER)
def frame_quit_scale():   return build_frame(CMD_QUIT_SCALE)

def frame_weight_unit(unit):
    return build_frame(CMD_WEIGHT_UNIT, [unit])


# ---------------------------------------------------------------------------
# Recipe encoding
# ---------------------------------------------------------------------------
def gate_volumes(volumes, dose_i):
    total = sum(volumes)
    if dose_i <= 0 or total <= 0 or not volumes:
        return [round(v) for v in volumes], 0
    r0 = round((total / dose_i) * 10)
    chosen, target = None, None
    for r in [r0, r0+1, r0-1, r0+2, r0-2]:
        if r <= 0 or r > 255:
            continue
        prod = float(r / 10.0) * float(dose_i)
        if int(prod) == int(prod + 0.5):
            chosen, target = r, int(prod)
            break
    if target is None:
        chosen = max(1, min(255, r0))
        target = int(float(float(chosen) / 10.0) * float(dose_i))
    ideal = [v * target / total for v in volumes]
    out = [int(x) for x in ideal]
    deficit = target - sum(out)
    if deficit > 0:
        order = sorted(range(len(out)), key=lambda i: ideal[i] - out[i], reverse=True)
        for k in range(min(deficit, len(order))):
            out[order[k]] += 1
    return out, int(chosen & 0xFF)


def encode_recipe_blob(recipe):
    pours = recipe["pours"]
    dose_g = recipe.get("dose_g", 15)
    grind_on = recipe.get("grinder_on", True) and recipe.get("grind_size", 0) > 0
    dose_i = round(dose_g) if dose_g else 0
    vols, ratio_byte = gate_volumes([max(0, p["volume_ml"]) for p in pours], dose_i)

    parts = bytearray()
    for i, p in enumerate(pours):
        volume = vols[i]
        temp = int(p.get("temp_c", 92))
        pat = pattern_to_byte(p.get("pattern", PAT_SPIRAL))
        agit_before = p.get("agitate_before", False)
        agit_after = p.get("agitate_after", False)
        vib = (1 if agit_before else 0) | (2 if agit_after else 0)
        flow = round(p.get("flow", 3.0) * 10) & 0xFF

        if volume > 127:
            for _ in range(volume // 127):
                parts.extend([127, temp, pat, vib])
            rem = volume % 127
            if rem:
                parts.extend([rem, temp, pat, vib])
        else:
            parts.extend([volume, temp, pat, vib])

        pause_s = p.get("pause_s", 0)
        wait_neg = (-pause_s) & 0xFF
        rpm = (recipe.get("rpm", 90) & 0xFF) if (i == 0 and grind_on) else 0
        parts.extend([wait_neg, 0, rpm, flow])

    blob = bytearray()
    blob.append(len(parts) & 0xFF)
    blob.extend(parts)
    # grind byte: 1-80 = grind size. 0 is NOT "off" - the machine grinds at its finest setting.
    # 0xFE tells it to skip the grinder (pre-ground coffee). Source: xbloom-api-doc recipe-payload.md.
    gs = max(1, min(int(recipe.get("grind_size", 0)), 80)) if grind_on else GRIND_SKIP
    blob.append(gs)
    blob.append(ratio_byte)
    return bytes(blob)


def build_load_frames(recipe):
    frames = []
    frames.append(build_frame(CMD_HANDSHAKE, [185, 1]))
    frames.append(build_frame(CMD_BYPASS_DOSE, [0, 0, round(recipe.get("dose_g", 15))]))

    cup = recipe.get("cup_type", 3)
    if cup == 2:
        cmax, cmin = 110.0, 90.0
    else:
        cmax, cmin = 200.0, 80.0
    frames.append(build_frame(CMD_SET_CUP, [float_bits(cmax), float_bits(cmin)]))

    blob = encode_recipe_blob(recipe)
    grind_on = recipe.get("grinder_on", True) and recipe.get("grind_size", 0) > 0
    cmd = CMD_RECIPE_GRIND if grind_on else CMD_RECIPE_NO_GRIND
    frames.append(build_frame(cmd, raw=blob))
    return frames


# ---------------------------------------------------------------------------
# Notification assembler (handles split/packed BLE notifications)
# ---------------------------------------------------------------------------
class Assembler:
    def __init__(self):
        self.pending = bytearray()

    def reset(self):
        self.pending = bytearray()

    def _frame_len(self, d):
        if len(d) < 9 or d[0] != 0x58 or d[1] != 0x02:
            return 0
        L = struct.unpack_from("<I", d, 5)[0]
        return L if 12 <= L <= 1024 else 0

    def _crc_ok(self, f):
        if len(f) < 12:
            return False
        want = f[-2] | (f[-1] << 8)
        return crc16_kermit(f[:-2]) == want

    def _could_open(self, d):
        if len(d) < 2:
            return d == bytes([0x58])[:len(d)] or d == bytes([0x58, 0x02])[:len(d)]
        if d[0] != 0x58 or d[1] != 0x02:
            return False
        if len(d) < 9:
            return True
        L = self._frame_len(d)
        return L > 0 and L > len(d)

    def feed(self, data):
        frames = []
        buf = None

        if self.pending:
            joined = bytes(self.pending) + data
            L = self._frame_len(joined)
            if L and L > len(joined):
                self.pending = bytearray(joined)
                return frames
            self.pending = bytearray()
            if L and L <= len(joined) and self._crc_ok(joined[:L]):
                frames.append(bytes(joined[:L]))
                buf = joined[L:]
            else:
                buf = data
        else:
            buf = data

        if not buf:
            return frames

        i = 0
        while i < len(buf):
            L = self._frame_len(buf[i:])
            if not L or L > len(buf) - i:
                break
            if self._crc_ok(buf[i:i+L]):
                frames.append(bytes(buf[i:i+L]))
            i += L

        if i < len(buf):
            rest = buf[i:]
            if self._could_open(rest):
                self.pending = bytearray(rest)

        return frames


def parse_event(frame):
    if len(frame) < 10 or frame[0] != 0x58 or frame[1] != 0x02:
        return None
    code = frame[3] | (frame[4] << 8)
    payload = frame[10:-2] if len(frame) > 12 else b""
    return {"code": code, "payload": payload}


# ---------------------------------------------------------------------------
# Built-in starter recipes
# ---------------------------------------------------------------------------
STARTER_RECIPES = [
    {
        "name": "Daily Pour Over", "cup_type": 3, "dose_g": 15, "grind_size": 45,
        "rpm": 90, "grinder_on": True, "color": "#E2DBA6",
        "pours": [
            {"volume_ml": 45, "temp_c": 93, "pattern": PAT_CENTERED, "pause_s": 30, "flow": 3.0},
            {"volume_ml": 95, "temp_c": 93, "pattern": PAT_SPIRAL, "pause_s": 10, "flow": 3.0},
            {"volume_ml": 100, "temp_c": 93, "pattern": PAT_SPIRAL, "pause_s": 0, "flow": 3.0},
        ],
    },
    {
        "name": "Light Roast", "cup_type": 3, "dose_g": 15, "grind_size": 42,
        "rpm": 100, "grinder_on": True, "color": "#E4A3A4",
        "pours": [
            {"volume_ml": 50, "temp_c": 96, "pattern": PAT_CENTERED, "pause_s": 35, "flow": 3.0},
            {"volume_ml": 105, "temp_c": 96, "pattern": PAT_SPIRAL, "pause_s": 10, "flow": 3.0},
            {"volume_ml": 100, "temp_c": 96, "pattern": PAT_SPIRAL, "pause_s": 0, "flow": 3.5},
        ],
    },
    {
        "name": "Dark Roast", "cup_type": 3, "dose_g": 16, "grind_size": 52,
        "rpm": 80, "grinder_on": True, "color": "#E6C3A0",
        "pours": [
            {"volume_ml": 40, "temp_c": 88, "pattern": PAT_CENTERED, "pause_s": 30, "flow": 3.0},
            {"volume_ml": 100, "temp_c": 88, "pattern": PAT_CIRCULAR, "pause_s": 10, "flow": 3.0},
            {"volume_ml": 100, "temp_c": 88, "pattern": PAT_CIRCULAR, "pause_s": 0, "flow": 3.0},
        ],
    },
]

CUP_NAMES = {1: "xPod", 2: "Omni", 3: "Other", 4: "Tea"}
PATTERN_NAMES = {1: "Centered", 2: "Spiral", 3: "Circular"}

# ---------------------------------------------------------------------------
# xBloom Cloud API
# ---------------------------------------------------------------------------
XBLOOM_API = "https://client-api.xbloom.com/"
XBLOOM_PUBLIC_KEY_PEM = b"""-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC4LF40GZ72SdhMyl765K/i4nY5
CPcHz2Q1IKWKZ9S79xmK7G8pUhbVf4EZLvnNF1+9IvOFQUKV5Z7ZNNviqSpnql9t
AT+8+J/He0R7pcirvVSxgdr2i9V/C/gmqAEZ5qVTzRnd3uWdFoKzPdEBxP0IporJ
1VBbCv90yBSOhVxO+QIDAQAB
-----END PUBLIC KEY-----
"""

CONFIG_FILE = Path(__file__).parent / "xbloom_config.json"
SCHEDULES_FILE = Path(__file__).parent / "schedules.json"

_rsa_key = load_pem_public_key(XBLOOM_PUBLIC_KEY_PEM)
CHUNK_SIZE = 117


def encrypt_body(plain: str) -> str:
    data = plain.encode("utf-8")
    cipher_parts = []
    for i in range(0, len(data), CHUNK_SIZE):
        chunk = data[i:i + CHUNK_SIZE]
        encrypted = _rsa_key.encrypt(chunk, rsa_padding.PKCS1v15())
        cipher_parts.append(encrypted)
    return base64.b64encode(b"".join(cipher_parts)).decode("ascii")


def xbloom_envelope(token=None, member_id=None, extra=None):
    d = {
        "interfaceVersion": 20240918,
        "skey": "testskey",
        "clientType": 2,
        "phoneType": "Android",
        "languageType": 0,
    }
    if token and member_id:
        d["memberId"] = member_id
        d["token"] = token
    if extra:
        d.update(extra)
    return d


cloud_session: aiohttp.ClientSession | None = None
cloud_token: str = ""
cloud_member_id: int = 0
cloud_email: str = ""
cloud_recipes: list = []

CLOUD_HEADERS = {
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Referer": "https://share-h5.xbloom.com/",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
}


def load_config():
    global cloud_token, cloud_member_id, cloud_email, preferred_machine, machine_chosen
    if CONFIG_FILE.exists():
        try:
            cfg = json.loads(CONFIG_FILE.read_text())
            cloud_token = cfg.get("token", "")
            cloud_member_id = cfg.get("member_id", 0)
            cloud_email = cfg.get("email", "")
            if cfg.get("machine"):
                preferred_machine = cfg["machine"]
                machine_chosen = True
        except Exception:
            pass


def save_config():
    cfg = {
        "token": cloud_token,
        "member_id": cloud_member_id,
        "email": cloud_email,
    }
    if machine_chosen:
        cfg["machine"] = preferred_machine
    hub_client._write_private(CONFIG_FILE, json.dumps(cfg, indent=2))


async def cloud_login(email: str, password: str) -> dict:
    global cloud_token, cloud_member_id, cloud_email
    env = xbloom_envelope()
    env["email"] = email
    env["password"] = password
    try:
        async with cloud_session.post(
            XBLOOM_API + "tMemberLogin.thtml",
            json=env, headers=CLOUD_HEADERS, timeout=aiohttp.ClientTimeout(total=30)
        ) as resp:
            data = await resp.json(content_type=None)
        if data.get("result") != "success":
            msg = data.get("msg") or data.get("message") or data.get("info") or "Wrong email or password"
            return {"ok": False, "error": str(msg)}
        member = data.get("member", {})
        tid = member.get("tableId")
        if isinstance(tid, str):
            tid = int(tid)
        tok = data.get("token", "")
        if not tid or not tok:
            return {"ok": False, "error": "No session returned"}
        cloud_token = tok
        cloud_member_id = tid
        cloud_email = email
        save_config()
        log.info("Cloud: signed in as %s", email)
        return {"ok": True, "email": email}
    except Exception as e:
        log.error("Cloud login error: %s", e)
        return {"ok": False, "error": str(e)}


def _parse_cloud_recipe(r: dict) -> dict | None:
    if not r.get("tableId") or not r.get("theName"):
        return None
    pours = []
    for q in (r.get("pourList") or []):
        pours.append({
            "volume_ml": float(q.get("volume", 0)),
            "temp_c": float(q.get("temperature", 92)),
            "pattern": int(q.get("pattern", PAT_SPIRAL)),
            "flow": float(q.get("flowRate", 3.0)),
            "pause_s": int(q.get("pausing", 0)),
            "agitate_before": q.get("isEnableVibrationBefore") == 1,
            "agitate_after": q.get("isEnableVibrationAfter") == 1,
        })
    gs = q_num(r.get("grinderSize", 0))
    return {
        "name": str(r.get("theName", "")),
        "dose_g": float(r.get("dose", 15)),
        "grind_size": int(round(gs)),
        "rpm": int(r.get("rpm", 90)),
        "cup_type": int(r.get("cupType", 3)),
        "grinder_on": r.get("isSetGrinderSize") == 1,
        "color": str(r.get("theColor", "#C9D5B8")),
        "cloud_id": str(r.get("tableId", "")),
        "cloud": True,
        "pours": pours,
    }


def q_num(v) -> float:
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


async def _fetch_recipe_list(endpoint: str) -> list[dict]:
    env = xbloom_envelope(cloud_token, cloud_member_id,
                          {"pageNumber": 1, "countPerPage": 100, "adaptedModel": 1})
    plain = json.dumps(env)
    b64 = encrypt_body(plain)
    body = '"' + b64 + '"'
    try:
        async with cloud_session.post(
            XBLOOM_API + endpoint,
            data=body, headers=CLOUD_HEADERS,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as resp:
            data = await resp.json(content_type=None)
        if data.get("result") != "success":
            code = data.get("code") or data.get("errorCode") or data.get("resultCode", 0)
            if isinstance(code, str):
                code = int(code) if code.isdigit() else 0
            if code in (10001, 20003):
                log.warning("Cloud: token expired for %s", endpoint)
            return []
        recipes = []
        for r in (data.get("list") or []):
            parsed = _parse_cloud_recipe(r)
            if parsed:
                recipes.append(parsed)
        return recipes
    except Exception as e:
        log.error("Cloud fetch %s error: %s", endpoint, e)
        return []


async def cloud_fetch_recipes() -> list[dict]:
    global cloud_recipes
    if not cloud_token or not cloud_member_id:
        return []
    mine = await _fetch_recipe_list("tuMyTeaRecipeCreated.tuhtml")
    shared = await _fetch_recipe_list("tuMyRecipeShared.tuhtml")
    seen_ids = {r.get("cloud_id") for r in mine}
    for s in shared:
        if s.get("cloud_id") not in seen_ids:
            mine.append(s)
    cloud_recipes = mine
    log.info("Cloud: synced %d recipes", len(cloud_recipes))
    if [r.get("name") for r in _all_recipes()][:10] != _alexa_recipe_names[:10]:
        start_fauxmo(_alexa_port)     # new recipe names: give Alexa a plug for each
    return cloud_recipes


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------
schedules: list[dict] = []


def load_schedules():
    global schedules
    if SCHEDULES_FILE.exists():
        try:
            schedules = json.loads(SCHEDULES_FILE.read_text())
        except Exception:
            schedules = []


def save_schedules():
    SCHEDULES_FILE.write_text(json.dumps(schedules, indent=2))


# Hot/cold classification chosen in the dashboard, keyed by recipe name (shared by all devices)
RECIPE_TAGS_FILE = Path(__file__).parent / "recipe_tags.json"
# Pro add-ons (analytics brew log, web push) are optional. When their files are absent — the
# free "base" build — these no-op stubs keep the server running with those features simply off.
class _NoBrewLog:
    enabled = False
    def version(self): return 0
    def add_brew(self, *a, **k): return ""
    def rate(self, *a, **k): return False
    def brews(self, *a, **k): return []
    def last_brew(self, *a, **k): return None
    def count(self): return 0
    def curves(self, *a, **k): return {"best": None, "last": None}
    def bags(self): return []
    def active_bag(self): return None
    def add_bag(self, *a, **k): return ""
    def update_bag(self, *a, **k): return False
    def add_weather_sample(self, *a, **k): pass
    def add_tank_event(self, *a, **k): pass
    def tank_events(self, *a, **k): return []


class _NoPush:
    enabled = False
    public_key = ""
    def add(self, *a, **k): return 0
    def remove(self, *a, **k): pass
    def count(self): return 0
    def send(self, *a, **k): return 0


try:
    from analytics_db import BrewLog, utc_now  # noqa: F401
    brewlog = BrewLog(Path(__file__).parent / "nuqta.db")
    HAS_ANALYTICS = True
except Exception as _e:
    brewlog = _NoBrewLog()
    HAS_ANALYTICS = False
    def utc_now():
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

# ---- Nuqta Pro: brew analytics, every theme and standby scene -----------------
# Unlocked by an active Nuqta account (Settings → Nuqta Pro → sign in).
PRO_DIR = Path(__file__).parent / "pro_pack"
PRO_STATE_FILE = PRO_DIR / "state.json"
PRO_GRACE_S = 30 * 86400           # stay unlocked offline for 30 days after the last good check
PRO_CHECK_EVERY_S = 6 * 3600
# A full owner checkout keeps the Pro files next to server.py: always Pro there.
PRO_OWNER_BUILD = HAS_ANALYTICS and (Path(__file__).parent / "analytics_db.py").exists()
_pro = {"active": PRO_OWNER_BUILD, "checked": 0.0}


def _pro_state_read() -> dict:
    try:
        return json.loads(PRO_STATE_FILE.read_text())
    except Exception:
        return {}


def _pro_state_write(**kw) -> None:
    try:
        PRO_DIR.mkdir(exist_ok=True)
        st = _pro_state_read()
        st.update(kw)
        PRO_STATE_FILE.write_text(json.dumps(st))
    except Exception as e:
        log.warning("Couldn't save Pro state: %s", e)


def _load_pro_pack(reload: bool = False) -> bool:
    """Import the downloaded analytics modules (or reload them after an update)."""
    global brewlog, HAS_ANALYTICS
    if PRO_OWNER_BUILD:
        return True
    if not (PRO_DIR / "analytics_db.py").exists():
        return False
    try:
        import importlib
        if str(PRO_DIR) not in sys.path:
            sys.path.append(str(PRO_DIR))
        importlib.invalidate_caches()
        import analytics_db
        if reload:
            importlib.reload(analytics_db)
            if "analytics" in sys.modules:
                importlib.reload(sys.modules["analytics"])
        brewlog = analytics_db.BrewLog(Path(__file__).parent / "nuqta.db")
        HAS_ANALYTICS = True
        return True
    except Exception as e:
        log.warning("Couldn't load Pro analytics: %s", e)
        return False


async def _sync_pro_pack() -> None:
    """Download the analytics modules from the hub when they're new or changed."""
    hub = hub_client.hub
    headers = {"Authorization": f"Bearer {hub.agent_token}"}
    async with hub_client.session() as http:
        async with http.get(f"{hub.hub_url}/pro/pack/version", headers=headers,
                            timeout=aiohttp.ClientTimeout(total=10)) as r:
            if r.status != 200:
                return
            version = (await r.json()).get("version")
        if version and version == _pro_state_read().get("version") and HAS_ANALYTICS:
            return
        async with http.get(f"{hub.hub_url}/pro/pack", headers=headers,
                            timeout=aiohttp.ClientTimeout(total=30)) as r:
            if r.status != 200:
                return
            pack = await r.json()
    files = pack.get("files") or {}
    allowed = {"analytics.py", "analytics_db.py"}
    PRO_DIR.mkdir(exist_ok=True)
    for name, text in files.items():
        if name in allowed:
            (PRO_DIR / name).write_text(text, encoding="utf-8")
    updated = HAS_ANALYTICS
    if _load_pro_pack(reload=updated):
        _pro_state_write(version=pack.get("version"))
        _analytics_cache.clear()
        log.info("Nuqta Pro analytics %s (%s)", "updated" if updated else "installed", pack.get("version"))


async def refresh_pro(force: bool = False) -> bool:
    """Ask the hub whether this account has Pro; fetch analytics if it does."""
    if PRO_OWNER_BUILD:
        return True
    hub = hub_client.hub
    if not hub.configured:
        _pro["active"] = False
        return False
    status = await hub.account_status(force=force)
    now = time.time()
    if status.get("error") == "unreachable":
        # offline: keep what we knew, for a while
        last_ok = _pro_state_read().get("active_at", 0)
        _pro["active"] = now - last_ok < PRO_GRACE_S
    else:
        _pro["active"] = bool(status.get("active"))
        if _pro["active"]:
            _pro_state_write(active_at=now)
    _pro["checked"] = now
    if _pro["active"]:
        try:
            await _sync_pro_pack()
        except Exception as e:
            log.warning("Pro analytics download failed: %s", e)
    return _pro["active"]


async def pro_loop() -> None:
    _load_pro_pack()  # use what's already downloaded straight away
    if not PRO_OWNER_BUILD and _pro_state_read().get("active_at") and hub_client.hub.configured:
        _pro["active"] = time.time() - _pro_state_read()["active_at"] < PRO_GRACE_S
    while True:
        try:
            await refresh_pro(force=True)
        except Exception as e:
            log.warning("Pro check failed: %s", e)
        await asyncio.sleep(PRO_CHECK_EVERY_S)


def pro_active() -> bool:
    return bool(_pro["active"])


try:
    from webpush import WebPush
    pusher = WebPush()
    HAS_PUSH = pusher.enabled
except Exception:
    pusher = _NoPush()
    HAS_PUSH = False
COLD_RE = re.compile(r"(\bice\b|\biced\b|\bcold\b|🧊|❄|بارد|مثلج|ثلج)", re.I)


def recipe_is_cold(recipe: dict | None) -> bool:
    if not recipe:
        return False
    tag = recipe_tags.get(recipe.get("name", "")) if isinstance(recipe_tags, dict) else None
    if tag in ("cold", "hot"):
        return tag == "cold"
    return bool(COLD_RE.search(recipe.get("name", "") or ""))


def recipe_meta(recipe: dict | None) -> dict:
    """Numbers the brew log keeps from the recipe at brew time."""
    r = recipe or {}
    pours = r.get("pours") or []
    water = sum(float(p.get("volume_ml") or 0) for p in pours)
    dose = float(r.get("dose_g") or 0) or None
    grinds = bool(r.get("grinder_on", True)) and (r.get("grind_size") or 0) > 0
    # planned time: each pour at its flow (ml/s) + its pause, plus grinding and heating up front
    planned = sum((float(p.get("volume_ml") or 0) / max(1.0, float(p.get("flow") or 3.0))) + float(p.get("pause_s") or 0)
                  for p in pours) + (25 if grinds else 0) + 15
    return {
        "recipe_id": str(r.get("cloud_id") or r.get("id") or r.get("name") or "") or None,
        "recipe_name": r.get("name"),
        "cold": recipe_is_cold(r),
        "dose_g": dose,
        "grind_size": float(r["grind_size"]) if grinds else None,
        "temp_c": float(pours[0].get("temp_c")) if pours and pours[0].get("temp_c") else None,
        "target_ratio": round(water / dose, 2) if dose and water else None,
        "planned_duration_s": round(planned) if pours else None,
    }


def log_brew_run(completed: bool):
    """Write the brew that just ended to the brew log and tell the screens (they offer the ★ sheet)."""
    try:
        recipe = brew_session["recipe"]
        meta = recipe_meta(recipe)
        start = datetime.fromtimestamp(state.brew_started, tz=timezone.utc).isoformat(timespec="seconds")
        curve = list(brew_curve)
        if curve:
            curve.append([round(state.brew_ended - state.brew_started, 1), round(state.water_ml, 1)])
        bid = brewlog.add_brew(ts=start, mode="brew", water_ml=round(state.water_ml, 1) or None, curve=curve or None,
                               final_weight_g=round(state.weight_g, 1),
                               duration_s=round(state.brew_ended - state.brew_started),
                               completed=completed, **meta)
        brewlog.add_tank_event(tank.ml)
        on_brew_log_changed()
        log.info("Brew log: %s %s (%s)", meta["recipe_name"] or "?", "completed" if completed else "stopped", bid)
        if main_loop:
            asyncio.run_coroutine_threadsafe(broadcast({"type": "brew_logged", "data": {
                "id": bid, "recipe": meta["recipe_name"], "completed": completed}}), main_loop)
    except Exception as e:
        log.warning("Brew log failed: %s", e)


# Brew curve: water poured against time during a recipe brew (seconds from start, ml)
brew_curve: list = []


def sample_curve(water_ml: float):
    if not state.brew_active or not state.brew_started:
        return
    t = round(time.time() - state.brew_started, 1)
    if brew_curve and (t - brew_curve[-1][0] < 1.0 and abs(water_ml - brew_curve[-1][1]) < 2):
        return
    brew_curve.append([t, round(water_ml, 1)])


# Water-only pours and grind-only runs are logged too (mode water / grind)
module_run: dict | None = None


def module_run_water(delta_ml: float):
    global module_run
    now = time.time()
    if not module_run or module_run["mode"] != "water":
        end_module_run()
        module_run = {"mode": "water", "start": now, "end": now, "water": 0.0}
    module_run["water"] += delta_ml
    module_run["end"] = now


def module_run_grind_start():
    global module_run
    end_module_run()
    module_run = {"mode": "grind", "start": time.time(), "end": None, "water": 0.0}


def end_module_run():
    """Close the water/grind run in progress, if any, and log it."""
    global module_run
    run, module_run = module_run, None
    if not run:
        return
    try:
        end = run["end"] or time.time()
        if run["mode"] == "water" and run["water"] < 1:
            return
        start = datetime.fromtimestamp(run["start"], tz=timezone.utc).isoformat(timespec="seconds")
        brewlog.add_brew(ts=start, mode=run["mode"], water_ml=round(run["water"], 1) if run["mode"] == "water" else None,
                         duration_s=round(end - run["start"]), completed=True)
        if run["mode"] == "water":
            brewlog.add_tank_event(tank.ml)
        on_brew_log_changed()
        log.info("Brew log: %s run (%.0f s)", run["mode"], end - run["start"])
    except Exception as e:
        log.warning("Brew log (module) failed: %s", e)


TANK_FILE = Path(__file__).parent / "tank.json"
TANK_CAP_ML = 1200          # placeholder capacity until the machine reports it


class Tank:
    """Water left in the tank: starts full on refill, drops with every ml the machine pours."""
    def __init__(self):
        self.ml = float(TANK_CAP_ML)
        self.cap = float(TANK_CAP_ML)
        self.last_water = 0.0
        self._saved = 0.0
        try:
            d = json.loads(TANK_FILE.read_text())
            self.cap = float(d.get("cap", TANK_CAP_ML))
            self.ml = max(0.0, min(self.cap, float(d.get("ml", self.cap))))
        except Exception:
            pass

    def save(self, force=False):
        if not force and time.time() - self._saved < 5:
            return
        self._saved = time.time()
        try:
            TANK_FILE.write_text(json.dumps({"ml": round(self.ml, 1), "cap": self.cap}))
        except Exception as e:
            log.warning("Tank save failed: %s", e)

    def poured(self, water_ml: float):
        """The machine's water counter (ml) for the current pour; it restarts from 0 on each pour."""
        if water_ml < self.last_water - 1 and module_run and module_run["mode"] == "water":
            end_module_run()          # the counter restarted: the previous pour is over
        delta = water_ml - self.last_water if water_ml >= self.last_water else water_ml
        self.last_water = water_ml
        if 0 < delta < 100:
            self.ml = max(0.0, self.ml - delta)
            self.save()
            if module_mode == "brewer":
                module_run_water(delta)

    def empty(self):
        if self.ml > 0:
            self.ml = 0.0
            self.save(force=True)

    def refill(self):
        self.ml = self.cap
        self.save(force=True)
        brewlog.add_tank_event(self.ml)


tank = Tank()

# Tank sensor (code 40522): the machine sends 1 when it sees no water (tank out or empty) and 0 when
# water is back. Taking the tank out flickers 1/0/1, so a value only counts after it holds for 2 s.
TANK_SETTLE_S = 2.0
tank_sensor = {"present": None, "token": 0, "out_since": 0.0, "prev_ml": None}


def tank_sensor_report(value: int):
    tank_sensor["token"] += 1
    token = tank_sensor["token"]
    if main_loop:
        main_loop.call_soon_threadsafe(lambda: main_loop.call_later(TANK_SETTLE_S, _tank_settle, value, token))


def _tank_settle(value: int, token: int):
    if token != tank_sensor["token"]:
        return  # a newer reading arrived: still flickering
    now = time.time()
    if value == 1 and tank_sensor["present"] is not False:
        tank_sensor.update(present=False, out_since=now, prev_ml=tank.ml)
        state.fault = "Out of water"
        log.info("Tank: out or empty (level was %.0f ml)", tank.ml)
    elif value == 0 and tank_sensor["present"] is not True:
        was_out = tank_sensor["present"] is False and now - tank_sensor["out_since"] >= 3
        tank_sensor["present"] = True
        if state.fault == "Out of water":
            state.fault = ""
        if was_out:
            prev = tank_sensor["prev_ml"]
            tank.refill()  # taken out and put back: most likely refilled; the screens ask to confirm
            log.info("Tank: back in after %.0f s, set to full (was %.0f ml)", now - tank_sensor["out_since"], prev or 0)
            asyncio.ensure_future(broadcast({"type": "tank_back", "data": {"prev": round(prev or 0), "cap": round(tank.cap)}}))
        else:
            log.info("Tank: water seen")
    else:
        return
    asyncio.ensure_future(broadcast({"type": "state", "data": state_payload()}))

recipe_tags: dict[str, str] = {}


def load_recipe_tags():
    global recipe_tags
    if RECIPE_TAGS_FILE.exists():
        try:
            data = json.loads(RECIPE_TAGS_FILE.read_text())
            recipe_tags = {k: v for k, v in data.items() if v in ("hot", "cold")}
        except Exception:
            recipe_tags = {}


async def handle_recipe_tags_get(request):
    return web.json_response(recipe_tags)


async def handle_recipe_tags_post(request):
    """Body: {"name": recipe name, "tag": "hot" | "cold" | null (null = back to automatic)}."""
    body = await request.json()
    name = str(body.get("name", "")).strip()
    tag = body.get("tag")
    if not name or tag not in ("hot", "cold", None):
        return web.json_response({"ok": False, "error": "Invalid name or tag"}, status=400)
    if tag is None:
        recipe_tags.pop(name, None)
    else:
        recipe_tags[name] = tag
    RECIPE_TAGS_FILE.write_text(json.dumps(recipe_tags, indent=2, ensure_ascii=False))
    await broadcast({"type": "recipe_tags", "data": recipe_tags})
    return web.json_response({"ok": True, "tags": recipe_tags})


WAKE_LEAD_S = 150          # start connecting/waking this long before a scheduled brew
FIRE_GRACE_S = 120         # still brew if the check runs up to this late (e.g. the Mac was busy)
CONNECT_TIMEOUT_S = 90     # how long to keep trying to reach the machine
START_TIMEOUT_S = 25       # how long to wait for the machine to report the brew started
FINISH_TIMEOUT_S = 20 * 60
_pre_woken: set[str] = set()
_fired: set[str] = set()
_sched_brew_task: asyncio.Task | None = None


def _is_connected() -> bool:
    return bool(ble_client and ble_client.is_connected and state.link == "connected")


async def _wait_until(cond, timeout: float, step: float = 0.5) -> bool:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if cond():
            return True
        await asyncio.sleep(step)
    return cond()


async def ensure_connected(timeout: float = CONNECT_TIMEOUT_S) -> bool:
    """Connect to the last-used / selected xBloom and wait until the link is up."""
    if _is_connected():
        return True
    log.info("Automation: connecting to %s", preferred_machine)
    await handle_connect_action()
    return await _wait_until(_is_connected, timeout, 1.0)


async def ensure_awake():
    """Send the wake handshake (never during a brew) and give the machine time to come up."""
    if state.brew_active or not _is_connected():
        return
    log.info("Automation: waking machine")
    await send_frame(build_frame(CMD_HANDSHAKE, [185, 1]))
    await _wait_until(lambda: not state.sleeping, 6)
    await asyncio.sleep(1.5)


# The machine remembers the amount of the last "water only" pour until that screen is properly left.
# A recipe started while it still remembers stops pouring at that amount (a 153 ml recipe ended at
# 30 ml on 2026-11-14 after a 30 ml hot-water command). So: note every use of the water screen, and
# before any recipe make the machine leave it and confirm that it did.
brewer_dirty = True           # water screen used and not yet confirmed closed (unknown at start-up)
_brewer_quit_seen = 0.0       # when the machine last confirmed leaving the water screen


async def leave_modules() -> None:
    """Before a recipe: stop and leave the water / grinder / scale screens, confirmed."""
    global module_mode, brewer_dirty
    if alexa_flags.get("grind") or module_mode == "grinder":
        await send_frame(frame_grinder_stop())
        await asyncio.sleep(0.3)
        await send_frame(frame_quit_grinder())
        await asyncio.sleep(0.3)
        alexa_flags["grind"] = False
    if module_mode == "scale":
        await send_frame(frame_quit_scale())
        await asyncio.sleep(0.3)
    if alexa_flags.get("water") or module_mode == "brewer":
        await send_frame(frame_brewer_stop())
        await asyncio.sleep(0.4)
        alexa_flags["water"] = False
    if brewer_dirty or module_mode == "brewer":
        for attempt in range(3):
            asked = time.time()
            if attempt:                      # the machine ignores "leave" unless it is on that screen
                await send_frame(frame_brewer_enter(pattern_to_byte(PAT_SPIRAL), 90))
                await asyncio.sleep(0.7)
            await send_frame(frame_quit_brewer())
            if await _wait_until(lambda: _brewer_quit_seen >= asked, 1.5, 0.1):
                brewer_dirty = False
                break
        else:
            log.warning("The machine did not confirm leaving the water screen before the brew")
        await _wait_until(lambda: state.activity_code in (0, 1), 2.0, 0.1)
    module_mode = ""
    end_module_run()


async def _load_and_start(recipe) -> str | None:
    if not ble_client or not ble_client.is_connected:
        return "Not connected"
    await leave_modules()
    await reset_for_brew(recipe)
    await asyncio.sleep(0.3)
    for f in build_load_frames(recipe):
        err = await send_frame(f)
        if err:
            return err
        await asyncio.sleep(0.15)
    await asyncio.sleep(0.8)
    return await send_frame(frame_execute())


async def skip_grind_and_brew(fallback: dict | None = None) -> str | None:
    """No beans: stop the stuck run and brew the same recipe with water only (grounds already in)."""
    recipe = brew_session.get("recipe") or fallback
    if not recipe:
        return "No recipe"
    brew_session["user_stopped"] = True
    await send_frame(frame_stop())
    await _wait_until(lambda: not state.brew_active, 8.0, 0.2)
    await asyncio.sleep(1.0)
    state.fault = ""
    log.info("No beans: brewing %s without grinding", recipe.get("name", "?"))
    return await _load_and_start({**recipe, "grinder_on": False})


async def run_scheduled_brew(sched: dict):
    """Connect, wake, load the saved recipe, start it, confirm it started, follow it to the end."""
    recipe = sched.get("recipe") or {}
    name = recipe.get("name", "?")
    if state.brew_active:
        log.info("Schedule %s skipped: a brew is already running", name)
        await broadcast({"type": "toast", "msg": f"Scheduled brew skipped — already brewing", "level": "info"})
        return
    log.info("Schedule firing: %s", name)
    await broadcast({"type": "toast", "msg": f"Scheduled brew: {name}"})

    if not await ensure_connected():
        log.error("Schedule %s failed: could not connect to %s", name, preferred_machine)
        await broadcast({"type": "toast", "msg": f"Scheduled brew failed — can't reach {preferred_machine}", "level": "error"})
        return
    await ensure_awake()

    started = False
    for attempt in (1, 2, 3):
        err = await _load_and_start(recipe)
        if err:
            log.warning("Schedule %s attempt %d send error: %s", name, attempt, err)
            await ensure_connected(30)
            await ensure_awake()
            continue
        if await _wait_until(lambda: state.brew_active, START_TIMEOUT_S):
            started = True
            break
        log.warning("Schedule %s attempt %d: machine did not start, retrying", name, attempt)
        await ensure_awake()
    if not started:
        log.error("Schedule %s failed: machine never started the brew", name)
        await broadcast({"type": "toast", "msg": f"Scheduled brew failed to start: {name}", "level": "error"})
        return

    log.info("Schedule %s: brewing", name)
    # The machine runs the recipe by itself; just follow it to the end (the BLE loop reconnects if needed).
    await _wait_until(lambda: not state.brew_active, FINISH_TIMEOUT_S, 2.0)
    log.info("Schedule %s ended: %s", name, state.activity)


async def prepare_for_schedule(lead: float):
    if state.brew_active:
        return
    log.info("Schedule in %ds — preparing machine", lead)
    if await ensure_connected():
        await ensure_awake()


def _occurrences(sched: dict, now: datetime):
    try:
        h, m = map(int, sched.get("time", "").split(":"))
    except ValueError:
        return
    once = sched.get("date")   # "YYYY-MM-DD": brew once on that day instead of on weekdays
    days = sched.get("days", [])
    for day_offset in (-1, 0, 1):
        target = (now + timedelta(days=day_offset)).replace(hour=h, minute=m, second=0, microsecond=0)
        if (target.strftime("%Y-%m-%d") == once) if once else (target.weekday() in days):
            yield target


async def schedule_checker():
    global _sched_brew_task
    while True:
        await asyncio.sleep(10)
        try:
            now = datetime.now()
            for sched in schedules:
                if not sched.get("enabled", True) or not sched.get("recipe"):
                    continue
                for target in _occurrences(sched, now):
                    lead = (target - now).total_seconds()
                    key = f"{sched.get('id', 0)}@{target:%Y-%m-%d %H:%M}"
                    if 0 < lead <= WAKE_LEAD_S and key not in _pre_woken:
                        _pre_woken.add(key)
                        asyncio.create_task(prepare_for_schedule(lead))
                    elif -FIRE_GRACE_S <= lead <= 0 and key not in _fired:
                        _fired.add(key)
                        if _sched_brew_task and not _sched_brew_task.done():
                            log.info("Schedule %s skipped: another scheduled brew is running", key)
                            continue
                        _sched_brew_task = asyncio.create_task(run_scheduled_brew(sched))
                        if sched.get("date"):
                            sched["enabled"] = False   # a one-off brew turns itself off after it runs
                            save_schedules()
                            await broadcast({"type": "schedules", "data": schedules})
        except Exception as e:
            log.error("Schedule checker error: %s", e)


# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
class MachineState:
    def __init__(self):
        self.link = "disconnected"
        self.machine_name = ""
        self.weight_g = 0.0
        self.water_ml = 0.0
        self.activity = "Unknown"
        self.activity_code = 0
        self.pour_index = 0
        self.sleeping = False
        self.fault = ""
        self.brew_active = False
        self.last_update = 0
        # brew session (set by reset_for_brew / the machine's activity reports)
        self.waiting = False        # the machine is in a recipe "wait" between pours
        self.wait_total = 0         # seconds of that wait, from the recipe (0 = unknown)
        self.wait_started = 0.0
        self.brew_started = 0.0
        self.brew_ended = 0.0
        self.pour_clock = 0.0       # first water of the brew: the machine's own timer starts here
        self.finished = False       # last brew ran to the end ("coffee ready" stays until the next brew)

    def to_dict(self):
        return {
            "link": self.link,
            "machine_name": self.machine_name,
            "weight_g": round(self.weight_g, 1),
            "water_ml": round(self.water_ml, 1),
            "activity": "Ready" if self.activity == "Done" and (not self.finished or time.time() - self.brew_ended > DONE_SHOW_S) else self.activity,
            "activity_code": self.activity_code,
            "pour_index": self.pour_index,
            "sleeping": self.sleeping,
            "fault": self.fault,
            "brew_active": self.brew_active,
            "selected_machine": preferred_machine,
            "tank_ml": round(tank.ml),
            "tank_out": tank_sensor["present"] is False,
            "tank_cap": round(tank.cap),
            "waiting": self.waiting,
            "wait_total": self.wait_total,
            "wait_left": max(0, int(round(self.wait_total - (time.time() - self.wait_started)))) if self.waiting and self.wait_total else 0,
            "brew_elapsed": int((self.brew_ended or time.time()) - (self.pour_clock or self.brew_started)) if self.pour_clock else 0,
            "recipe_name": (brew_session["recipe"] or {}).get("name", ""),
            "target_ml": recipe_total_ml(brew_session["recipe"]),
        }


# The recipe being brewed and what the user asked for, so a machine "wait" isn't shown as a pause
brew_session = {"recipe": None, "user_paused": False, "user_stopped": False}
# The recipe of the brew in progress survives a Nuqta restart, so "brew without grinding" and the
# screens still know what the machine is brewing.
LAST_BREW_FILE = Path(__file__).parent / "last_brew.json"
try:
    brew_session["recipe"] = json.loads(LAST_BREW_FILE.read_text())
except Exception:
    pass
BREW_CODES = (29, 30, 34, 35, 16, 31)


def recipe_total_ml(recipe) -> int:
    return int(round(sum(max(0.0, float(p.get("volume_ml", 0) or 0)) for p in (recipe or {}).get("pours", []))))


def _recipe_wait_s() -> int:
    """Wait after the pour that just finished, read from the recipe."""
    pours = (brew_session["recipe"] or {}).get("pours", [])
    if not pours:
        return 0
    if state.water_ml > 0.5:
        cum = 0.0
        for p in pours:
            cum += float(p.get("volume_ml", 0) or 0)
            if state.water_ml <= cum + 3:
                return int(p.get("pause_s", 0) or 0)
        return 0
    idx = min(max(int(state.pour_index or 0), 0), len(pours) - 1)
    return int(pours[idx].get("pause_s", 0) or 0)


def _enter_pause_like():
    """The machine reported a pause: the user's pause, or the recipe's wait between pours."""
    if brew_session["user_paused"]:
        state.activity = "Paused"
        state.waiting = False
        return
    if not state.waiting:
        state.waiting = True
        state.wait_total = _recipe_wait_s()
        state.wait_started = time.time()
        log.info("Recipe wait: %ss (water %.1f ml)", state.wait_total, state.water_ml)
    state.activity = "Waiting"


def _brew_began():
    brew_curve.clear()
    state.finished = False
    state.waiting = False
    if not state.brew_started or state.brew_ended:
        state.brew_started = time.time()
        state.brew_ended = 0.0
        state.pour_clock = 0.0


MIN_BREW_S = 20      # a shorter "brew" is the machine replaying its status (e.g. right after connecting)
DONE_SHOW_S = 15 * 60  # how long "coffee ready" (and the full cup) stays on screen


def _brew_ended():
    state.waiting = False
    state.brew_ended = time.time()
    if not state.brew_started or state.brew_ended - state.brew_started < MIN_BREW_S:
        log.info("Ignored a %.0fs brew report (not a real brew)", state.brew_ended - state.brew_started if state.brew_started else 0)
        state.brew_started = state.brew_ended = 0.0
        if state.activity in ("Done", "Brewing", "Paused", "Waiting"):
            state.activity = "Ready"
        return
    if brew_session["user_stopped"] or state.activity == "Abandoned":
        log.info("Brew stopped")
        log_brew_run(completed=False)
        return
    total = recipe_total_ml(brew_session["recipe"]) if brew_session["recipe"] else 0
    if total and state.water_ml < total * 0.85:
        log.warning("Brew ended early: %.0f of %d ml poured", state.water_ml, total)
        state.activity = "Ready"
        state.fault = state.fault or "Ended early"
        log_brew_run(completed=False)
        if main_loop:
            asyncio.run_coroutine_threadsafe(broadcast({"type": "brew_short", "data": {
                "recipe": (brew_session["recipe"] or {}).get("name", ""),
                "poured": round(state.water_ml), "total": total}}), main_loop)
        return
    state.finished = True
    state.activity = "Done"
    name = (brew_session["recipe"] or {}).get("name", "")
    log.info("Brew finished: %s (%.1f g)", name or "?", state.weight_g)
    log_brew_run(completed=True)
    notify_finished(name, state.weight_g)


def notify_finished(name: str, weight: float, demo: bool = False):
    """Tell every dashboard and this Mac that the coffee is ready."""
    msg = {"type": "brew_finished", "data": {"recipe": name, "weight": round(weight, 1), "demo": demo}}
    if main_loop:
        asyncio.run_coroutine_threadsafe(broadcast(msg), main_loop)
    if sys.platform == "darwin":
        try:
            import subprocess
            text = f"{name} is ready" if name else "Your coffee is ready"
            text = text.replace('"', "'").replace("\\", "")
            subprocess.Popen(["osascript", "-e", f'display notification "{text}" with title "Nuqta" sound name "Glass"'],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            log.warning("Mac notification failed: %s", e)
    if pusher.enabled and pusher.count() and not demo and pro_active():
        title = "قهوتك جاهزة · Coffee ready"
        body = f"{name} · {round(weight)} g" if name else f"{round(weight)} g"
        import threading
        threading.Thread(target=lambda: log.info("Web Push sent to %d device(s)", pusher.send(title, body, tag="brew", url="/")), daemon=True).start()
    if _hub_agent_ws is not None and not _hub_agent_ws.closed and not demo and main_loop and pro_active():
        title = "قهوتك جاهزة · Coffee ready"
        body = f"{name} · {round(weight)} g" if name else f"{round(weight)} g"
        push_envelope = json.dumps({"__hub_push__": True, "title": title, "body": body})
        asyncio.run_coroutine_threadsafe(_hub_agent_ws.send_str(push_envelope), main_loop)


async def reset_for_brew(recipe: dict):
    """Before a recipe starts: tare the scale and zero every number so the new brew starts clean."""
    brew_session.update(recipe=recipe, user_paused=False, user_stopped=False)
    try:
        LAST_BREW_FILE.write_text(json.dumps(recipe))
    except Exception:
        pass
    if state.fault in ("Ended early", "No beans"):
        state.fault = ""
    state.weight_g = 0.0
    state.water_ml = 0.0
    state.pour_index = 0
    state.waiting = False
    state.wait_total = 0
    state.finished = False
    state.brew_started = 0.0
    state.brew_ended = 0.0
    state.pour_clock = 0.0
    if state.activity == "Done":
        state.activity = "Ready"
    err = await send_frame(frame_tare())
    if err:
        log.warning("Tare before brew failed: %s", err)
    await broadcast({"type": "brew_reset", "data": {"recipe": recipe.get("name", "")}})
    await broadcast({"type": "state", "data": state_payload()})


state = MachineState()

# Demo brew: when set, these fields are layered over the real state sent to dashboards.
# Nothing is sent to the machine while a demo runs.
demo_state: dict | None = None
_demo_task: asyncio.Task | None = None
_demo_paused = False
_demo_stop = False
DEMO_TICK = 0.4


def state_payload() -> dict:
    d = state.to_dict()
    if demo_state is not None:
        d.update(demo_state)
    return d


DEMO_RECIPE = {
    "name": "Demo", "grind_size": 45, "grinder_on": True, "dose_g": 15,
    "pours": [{"volume_ml": 45, "pause_s": 8}, {"volume_ml": 95, "pause_s": 5}, {"volume_ml": 100, "pause_s": 0}],
}


async def run_demo_brew():
    """Plays a short brew (grind, heat, bloom + wait, pours + wait, done) to every dashboard."""
    global demo_state, _demo_paused, _demo_stop
    _demo_paused = _demo_stop = False
    started = time.time()
    demo_state = {
        "link": "connected", "machine_name": f"{preferred_machine or 'XBLOOM'} (demo)", "sleeping": False,
        "fault": "", "brew_active": True, "activity": "Grinding", "activity_code": 34,
        "weight_g": 0.0, "water_ml": 0.0, "waiting": False, "wait_total": 0, "wait_left": 0,
        "brew_elapsed": 0, "recipe_name": DEMO_RECIPE["name"], "target_ml": recipe_total_ml(DEMO_RECIPE),
    }
    log.info("Demo brew started")
    await broadcast({"type": "brew_reset", "data": {"recipe": DEMO_RECIPE["name"], "demo": True}})
    await broadcast({"type": "toast", "msg": "Demo brew — nothing is sent to the machine"})

    async def tick(**fields) -> bool:
        while _demo_paused and not _demo_stop:
            await asyncio.sleep(0.2)
        if _demo_stop:
            return False
        demo_state.update(fields, brew_elapsed=int(time.time() - started))
        await broadcast({"type": "state", "data": state.to_dict()})
        await asyncio.sleep(DEMO_TICK)
        return True

    async def run() -> bool:
        for _ in range(15):
            if not await tick(activity="Grinding", activity_code=34):
                return False
        for _ in range(8):
            if not await tick(activity="Starting", activity_code=29):
                return False
        water = 0.0
        cum = 0
        for p in DEMO_RECIPE["pours"]:
            cum += p["volume_ml"]
            while water < cum:
                water = min(cum, water + 4.0)
                if not await tick(activity="Brewing", activity_code=35, waiting=False, wait_total=0, wait_left=0,
                                  water_ml=round(water, 1), weight_g=round(max(0.0, water * 0.88 - 4), 1)):
                    return False
            n = int(p["pause_s"] / DEMO_TICK)
            for i in range(n):
                if not await tick(activity="Waiting", activity_code=31, waiting=True, wait_total=p["pause_s"],
                                  wait_left=max(0, round(p["pause_s"] - i * DEMO_TICK)),
                                  weight_g=round(min(water * 0.9, demo_state["weight_g"] + 0.3), 1)):
                    return False
        return True

    try:
        finished = await run()
        if finished:
            demo_state.update(brew_active=False, activity="Done", activity_code=36, waiting=False, weight_g=216.3)
            notify_finished(DEMO_RECIPE["name"], 216.3, demo=True)
        else:
            demo_state.update(brew_active=False, activity="Abandoned", activity_code=1, waiting=False)
        await broadcast({"type": "state", "data": state.to_dict()})
        log.info("Demo brew %s", "finished" if finished else "stopped")
        await asyncio.sleep(10)
    finally:
        demo_state = None
        await broadcast({"type": "state", "data": state.to_dict()})


async def handle_demo_brew(request):
    global _demo_task
    if state.brew_active:
        return web.json_response({"ok": False, "error": "A real brew is running"})
    if _demo_task and not _demo_task.done():
        return web.json_response({"ok": False, "error": "Demo already running"})
    _demo_task = asyncio.create_task(run_demo_brew())
    return web.json_response({"ok": True})


async def demo_control(action: str):
    global _demo_paused, _demo_stop
    if action == "pause":
        _demo_paused = True
        demo_state.update(activity="Paused", activity_code=31, waiting=False)
    elif action == "resume":
        _demo_paused = False
        demo_state.update(activity="Brewing", activity_code=35)
    elif action == "stop":
        _demo_stop = True
        _demo_paused = False
    elif action == "tare":
        demo_state.update(weight_g=0.0)
    await broadcast({"type": "state", "data": state.to_dict()})
ws_clients: set[web.WebSocketResponse] = set()
_hub_agent_ws = None  # the outbound connection to the Nuqta Cloud hub, when remote access is on
_hub_wake: asyncio.Event | None = None  # set on sign-in/sign-out so the agent loop reacts at once
ble_client: bleak.BleakClient | None = None
ble_lock = asyncio.Lock()
assembler = Assembler()
main_loop: asyncio.AbstractEventLoop | None = None

# Broadcast throttling
_last_broadcast_time: float = 0
_last_broadcast_state: dict | None = None


async def broadcast(msg: dict):
    if msg.get("type") == "state" and demo_state is not None:
        msg = {"type": "state", "data": {**msg["data"], **demo_state}}
    dead = set()
    text = json.dumps(msg)
    for ws in list(ws_clients):
        try:
            await asyncio.wait_for(ws.send_str(text), timeout=2.0)
        except Exception:
            dead.add(ws)
    ws_clients.difference_update(dead)


def _should_broadcast(new_state: dict) -> bool:
    global _last_broadcast_time, _last_broadcast_state
    now = time.time()
    if _last_broadcast_state is None or _last_broadcast_state != new_state:
        _last_broadcast_time = now
        _last_broadcast_state = new_state.copy()
        return True
    if now - _last_broadcast_time >= 0.5:
        _last_broadcast_time = now
        return True
    return False


# ---------------------------------------------------------------------------
# BLE connection management
# ---------------------------------------------------------------------------
def on_disconnect(client):
    global ble_client
    log.info("BLE disconnected")
    ble_client = None
    state.link = "disconnected"
    state.machine_name = ""
    assembler.reset()
    if main_loop:
        asyncio.run_coroutine_threadsafe(broadcast({"type": "state", "data": state.to_dict()}), main_loop)


TRACE_FILE = Path(__file__).parent / "brew_trace.log"
# A single mode opened from the dashboard ("grinder", "brewer" or "scale"). While set, the machine's
# activity reports belong to that module, not to a recipe brew: no brew start/finish, no "coffee ready".
module_mode = ""
_trace_last: dict = {}
_trace_all_until = 0.0   # POST /api/trace?secs=N records every packet (idle too) for N seconds


def _trace_packet(code: int, payload: bytes, frame: bytes):
    """Write raw machine packets to brew_trace.log while brewing (streamed values twice a second)."""
    try:
        streamed = code in (N_WEIGHT, N_WEIGHT_ALT, N_WATER, N_MACHINE_INFO)
        if streamed:
            if not state.brew_active and time.time() > _trace_all_until:
                return
            now = time.time()
            if now - _trace_last.get(code, 0) < 0.5:
                return
            _trace_last[code] = now
        f32 = struct.unpack_from("<f", payload)[0] if len(payload) >= 4 else None
        u32 = struct.unpack_from("<I", payload)[0] if len(payload) >= 4 else None
        t = time.time() - state.brew_started if state.brew_started and state.brew_active else -1
        with open(TRACE_FILE, "a") as fh:
            fh.write(f"{time.strftime('%H:%M:%S')} t={t:6.1f} code={code:5d} len={len(frame):3d} "
                     f"f32={f32 if f32 is None else round(f32, 2)} u32={u32} payload={payload.hex()}\n")
    except Exception:
        pass


def on_notification(sender, data: bytearray):
    global module_mode, brewer_dirty, _brewer_quit_seen
    frames = assembler.feed(bytes(data))
    for frame in frames:
        ev = parse_event(frame)
        if not ev:
            continue
        code = ev["code"]
        payload = ev["payload"]
        _trace_packet(code, payload, frame)
        changed = True
        was_active = state.brew_active

        if code in (CMD_BREWER_ENTER, CMD_BREWER_START, CMD_BREWER_STOP):
            brewer_dirty = True
        elif code == CMD_QUIT_BREWER:
            _brewer_quit_seen = time.time()

        if code in (N_WEIGHT, N_WEIGHT_ALT) and len(payload) >= 4:
            state.weight_g = struct.unpack_from("<f", payload)[0]
        elif code == N_WATER and len(payload) >= 4:
            v = struct.unpack_from("<f", payload)[0]
            # this machine reports microlitres (steps of 12.5 µl; a 250 ml recipe ends at 250000.0);
            # the machine's display shows millilitres. Values from 0 up are µl, so convert them all.
            v /= 1000.0
            state.water_ml = v
            sample_curve(v)
            tank.poured(v)
            if state.brew_active and v > 0.5 and not state.pour_clock and state.activity_code != 34:
                state.pour_clock = time.time()
        elif code == N_ACTIVITY and len(payload) >= 4:
            act = struct.unpack_from("<I", payload)[0]
            state.activity_code = act
            if act == 31:
                state.brew_active = True
                _enter_pause_like()
            elif act in BREW_CODES:
                state.brew_active = True
                state.waiting = False
                state.activity = ACTIVITY_NAMES[act]
            elif act == 36:
                # "done" only counts at the end of a brew; on connect the machine replays its last status
                if state.brew_active:
                    state.brew_active = False
                    state.activity = "Done"
                elif not state.finished:
                    state.activity = "Ready"
            elif act in ACTIVITY_NAMES:
                state.brew_active = False
                if not state.finished:
                    state.activity = ACTIVITY_NAMES[act]
            else:
                # unknown code: log it and don't end a running brew because of it
                log.info("Machine activity code %d (unknown) during %s", act, "brew" if state.brew_active else "idle")
                if not state.brew_active:
                    state.activity = f"Unknown ({act})"
            if state.brew_active:
                state.sleeping = False
        elif code == N_BLOOM and len(payload) >= 4:
            state.pour_index = struct.unpack_from("<I", payload)[0]
        elif code == N_ENJOY:
            if state.brew_active:
                state.brew_active = False
                state.activity = "Done"
        elif code == N_ABANDONED:
            state.brew_active = False
            state.activity = "Abandoned"
        elif code in (40515, 9009, 9010):
            log.info("Machine pause event %d", code)
            if state.brew_active:
                _enter_pause_like()
        elif code in (40516, 9011):
            log.info("Machine resume event %d", code)
            state.waiting = False
            if state.brew_active:
                state.activity = "Brewing"
        elif code == N_SLEEPING:
            # the machine can report sleep while a brew runs (display dims); it isn't asleep then
            if not state.brew_active:
                state.sleeping = True
        elif code == N_AWAKE:
            state.sleeping = False
            state.fault = ""
        elif code == N_FAULT_NO_WATER and len(payload) >= 4:
            # 1 = no water seen (tank out or empty), 0 = water seen; settle flicker before acting
            tank_sensor_report(struct.unpack_from("<I", payload)[0])
            changed = False
        elif code in FAULT_NAMES:
            state.fault = FAULT_NAMES[code]
        else:
            changed = False

        if code == N_ACTIVITY and state.activity_code == 1:
            module_mode = ""        # back on the machine's home screen
            end_module_run()
        if module_mode and not was_active:
            # module activity (water pour, grinding, scale): not a recipe brew
            state.brew_active = False
            state.waiting = False
            if state.activity in ("Done", "Brewing", "Paused", "Waiting", "Grinding", "Starting"):
                state.activity = "Ready"

        if not was_active and state.brew_active:
            _brew_began()
        elif was_active and not state.brew_active:
            _brew_ended()
            changed = True

        if changed and main_loop:
            sd = state.to_dict()
            if _should_broadcast(sd):
                asyncio.run_coroutine_threadsafe(
                    broadcast({"type": "state", "data": sd}), main_loop
                )


_ble_scanning = False


def _check_ble_permission() -> tuple[bool, str]:
    """Check CoreBluetooth authorization. Status 0 (notDetermined) is allowed — it triggers the system dialog."""
    try:
        import CoreBluetooth
        status = CoreBluetooth.CBManager.authorization()
        if status in (0, 3):
            return True, ""
        if status == 2:
            return False, "Bluetooth permission denied. Open System Settings > Privacy & Security > Bluetooth and allow this terminal app."
        return False, f"Bluetooth restricted (status={status})"
    except ImportError:
        return True, ""


async def _do_scan_and_connect():
    """One scan-connect cycle. Returns True if connected."""
    global ble_client, preferred_machine, machine_chosen
    state.link = "scanning"
    await broadcast({"type": "state", "data": state.to_dict()})
    log.info("Scanning for xBloom...")

    devices = await asyncio.wait_for(
        bleak.BleakScanner.discover(timeout=5.0), timeout=10.0
    )
    log.info("Scan found %d device(s): %s", len(devices),
             ", ".join(f"{d.name or '?'} ({d.address})" for d in devices[:10]))

    target = None
    fallback = None
    for d in devices:
        name = d.name or ""
        if preferred_machine and name.upper() == preferred_machine.upper():
            target = d
            break
        if not fallback and name.upper().startswith(NAME_PREFIX):
            fallback = d
    if not target and not machine_chosen:
        target = fallback
    if not target:
        return False

    state.link = "connecting"
    state.machine_name = target.name or "XBLOOM"
    await broadcast({"type": "state", "data": state.to_dict()})
    log.info("Connecting to %s (%s)...", target.name, target.address)

    client = bleak.BleakClient(target, disconnected_callback=on_disconnect)
    await client.connect()
    await client.start_notify(UUID_RX, on_notification)
    ble_client = client
    state.link = "connected"
    assembler.reset()
    log.info("Connected to %s", target.name)
    if target.name and (not machine_chosen or preferred_machine != target.name):
        preferred_machine, machine_chosen = target.name, True
        save_config()
    await broadcast({"type": "state", "data": state.to_dict()})

    try:
        hs = build_frame(CMD_HANDSHAKE, [185, 1])
        await client.write_gatt_char(UUID_TX, hs, response=False)
        log.info("Handshake sent")
    except Exception as e:
        log.warning("Handshake failed: %s", e)
    return True


async def scan_and_connect():
    """BLE loop — waits for 'connect' trigger, then scans + auto-reconnects."""
    global _ble_scanning
    _ble_scanning = True
    log.info("BLE connecting — scanning for '%s'", NAME_PREFIX)

    try:
        while _ble_scanning:
            if ble_client and ble_client.is_connected:
                await asyncio.sleep(2)
                continue
            try:
                found = await _do_scan_and_connect()
                if not found:
                    log.info("No xBloom found, retrying in 3s...")
                    await asyncio.sleep(3)
            except asyncio.TimeoutError:
                log.warning("BLE scan timed out, retrying...")
                state.link = "error"
                state.fault = "Scan timed out"
                await broadcast({"type": "state", "data": state.to_dict()})
                await asyncio.sleep(5)
            except Exception as e:
                log.error("BLE error: %s", e)
                state.link = "error"
                state.fault = str(e)
                await broadcast({"type": "state", "data": state.to_dict()})
                await asyncio.sleep(3)
    finally:
        _ble_scanning = False


async def handle_connect_action() -> dict:
    """Called from WS 'connect' action. Checks BLE permission, then starts scanning."""
    global _ble_scanning
    if ble_client and ble_client.is_connected:
        return {"ok": True, "msg": "Already connected"}
    if _ble_scanning:
        return {"ok": True, "msg": "Already scanning"}

    ok, err = _check_ble_permission()
    if not ok:
        log.warning("BLE unavailable: %s", err)
        state.link = "no_permission"
        state.fault = err
        await broadcast({"type": "state", "data": state.to_dict()})
        return {"ok": False, "error": err}

    log.info("BLE permission OK — starting scan loop")
    asyncio.create_task(scan_and_connect())
    return {"ok": True, "msg": "Scanning..."}


async def scan_devices() -> dict:
    """One-off scan listing nearby xBloom machines for the dashboard's machine picker."""
    if state.link in ("scanning", "connecting"):
        return {"ok": False, "error": "busy", "devices": []}
    ok, err = _check_ble_permission()
    if not ok:
        return {"ok": False, "error": err, "devices": []}

    found = await asyncio.wait_for(
        bleak.BleakScanner.discover(timeout=4.0, return_adv=True), timeout=10.0
    )
    devices = {}
    for dev, adv in found.values():
        name = dev.name or adv.local_name or ""
        if name.upper().startswith(NAME_PREFIX):
            devices[name] = {"name": name, "address": dev.address, "rssi": adv.rssi}
    # A connected machine usually stops advertising, so add it explicitly
    if ble_client and ble_client.is_connected and state.machine_name and state.machine_name not in devices:
        devices[state.machine_name] = {"name": state.machine_name, "address": "", "rssi": None}
    result = sorted(devices.values(), key=lambda d: -(d["rssi"] if d["rssi"] is not None else 0))
    log.info("Device scan: %s", ", ".join(d["name"] for d in result) or "none")
    return {"ok": True, "devices": result}


async def select_machine(name: str) -> dict:
    """Remember the chosen machine and (re)connect to it."""
    global preferred_machine, machine_chosen, ble_client
    name = (name or "").strip()
    if not name.upper().startswith(NAME_PREFIX):
        return {"ok": False, "error": "Not an xBloom machine"}
    changed = name.upper() != preferred_machine.upper() or not machine_chosen
    preferred_machine = name
    machine_chosen = True
    if changed:
        save_config()
        log.info("Selected machine: %s", name)
    if ble_client and ble_client.is_connected and state.machine_name.upper() != name.upper():
        log.info("Switching from %s to %s", state.machine_name, name)
        old = ble_client
        ble_client = None
        await old.disconnect()
    return await handle_connect_action()


_TRACE_SENT = {CMD_BYPASS_DOSE, CMD_SET_CUP, CMD_RECIPE_GRIND, CMD_RECIPE_NO_GRIND, CMD_EXECUTE,
               CMD_BREW_STOP, CMD_BREWER_START, CMD_BREWER_STOP, CMD_QUIT_BREWER, CMD_GRINDER_ENTER, CMD_GRINDER_START}


def _trace_sent(frame: bytes) -> None:
    """Note what Nuqta sends the machine (recipe loads, start/stop) in brew_trace.log."""
    try:
        code = frame_code(frame)
        if code not in _TRACE_SENT:
            return
        extra = ""
        if code in (CMD_RECIPE_GRIND, CMD_RECIPE_NO_GRIND):
            body = frame[10:-2]
            n = body[0] if body else 0
            extra = f" grind={body[1 + n] if len(body) > n + 1 else '?'} ratio={body[2 + n] if len(body) > n + 2 else '?'} pours={body[1:1 + n].hex()}"
        with open(TRACE_FILE, "a") as fh:
            fh.write(f"{time.strftime('%H:%M:%S')} SENT code={code:5d} len={len(frame):3d}{extra} raw={frame.hex()}\n")
    except Exception:
        pass


async def send_frame(frame: bytes) -> str | None:
    if not ble_client or not ble_client.is_connected:
        return "Not connected"
    _trace_sent(frame)
    try:
        async with ble_lock:
            await ble_client.write_gatt_char(UUID_TX, frame, response=False)
        return None
    except Exception as e:
        return str(e)


async def send_confirmed(frame: bytes) -> str | None:
    err = await send_frame(frame)
    if err:
        return err
    await asyncio.sleep(0.15)
    return None


# ---------------------------------------------------------------------------
# Web handlers
# ---------------------------------------------------------------------------
async def handle_index(request):
    html_path = Path(__file__).parent / "dashboard.html"
    return web.FileResponse(html_path)

async def handle_font(request):
    name = Path(request.match_info["name"]).name
    font_path = Path(__file__).parent / "fonts" / name
    if not font_path.exists():
        font_path = Path(__file__).parent / name
    if font_path.exists() and font_path.suffix in (".otf", ".ttf", ".woff", ".woff2"):
        return web.FileResponse(font_path)
    raise web.HTTPNotFound()


# Web app manifest: "Add to Home screen" then opens the dashboard fullscreen, without browser bars
WEB_MANIFEST = {
    "name": "Nuqta · نُقطة",
    "short_name": "Nuqta",
    "start_url": "/",
    "scope": "/",
    "display": "fullscreen",
    "display_override": ["fullscreen", "standalone"],
    "orientation": "any",
    "background_color": "#12100E",
    "theme_color": "#12100E",
    "icons": [
        {"src": "/nuqta-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "/nuqta-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
}


async def handle_manifest(request):
    return web.json_response(WEB_MANIFEST, content_type="application/manifest+json")


async def handle_app_icon(request):
    size = request.match_info["size"]
    path = Path(__file__).parent / f"nuqta-icon-{size}.png"
    if size in ("192", "512") and path.exists():
        return web.FileResponse(path)
    raise web.HTTPNotFound()


def _all_recipes():
    return STARTER_RECIPES + cloud_recipes


async def _send_ws_snapshot(ws):
    """The initial burst a dashboard needs on open: hello, state, recipes,
    schedules, tags, cloud status. A local tab gets this once when IT
    connects. The hub's single outbound agent connection stays open for
    hours, so it needs this resent on demand — see __hub_client_connected__
    below — otherwise a phone that attaches later sees nothing."""
    await ws.send_json({"type": "hello", "build": dashboard_build_id()})
    if weather_now:
        await ws.send_json({"type": "weather", "data": weather_now})
    await ws.send_json({"type": "state", "data": state_payload()})
    await ws.send_json({"type": "recipes", "data": _all_recipes()})
    await ws.send_json({"type": "schedules", "data": schedules})
    await ws.send_json({"type": "recipe_tags", "data": recipe_tags})
    await ws.send_json({"type": "cloud_status", "data": {
        "signed_in": bool(cloud_token and cloud_member_id),
        "email": cloud_email,
    }})


# A remote phone has no direct route to this server, so its dashboard sends its
# data requests through the live link; they are answered by this same server.
REMOTE_HTTP_BLOCKED = ("/api/hub/", "/api/cloud/login", "/api/push/", "/api/trace")
_dashboard_port = 8420


async def _relay_http(ws, req: dict) -> None:
    rid = req.get("id")
    path = str(req.get("path", ""))
    method = str(req.get("method", "GET")).upper()
    out = {"type": "__http__", "id": rid, "status": 403, "body": ""}
    try:
        if (path.startswith("/api/") and ".." not in path
                and not path.startswith(REMOTE_HTTP_BLOCKED)
                and method in ("GET", "POST", "PUT", "DELETE")):
            body = req.get("body")
            async with aiohttp.ClientSession() as http:
                async with http.request(
                        method, f"http://127.0.0.1:{_dashboard_port}{path}",
                        data=body.encode() if isinstance(body, str) else None,
                        headers={"Content-Type": "application/json"} if body else None,
                        timeout=aiohttp.ClientTimeout(total=20)) as r:
                    out["status"] = r.status
                    out["body"] = (await r.text())[:900_000]
    except Exception as e:
        out["status"] = 502
        log.warning("Remote request %s %s failed: %s", method, path, e)
    try:
        await ws.send_str(json.dumps(out))
    except Exception:
        pass


async def _run_ws_session(ws, peer: str = ""):
    """Runs the dashboard protocol over an already-open ws. aiohttp's
    server-side WebSocketResponse (a local tab) and client-side
    ClientWebSocketResponse (the outbound connection to the Nuqta Cloud
    hub, when remote access is on) both support send_json/send_str and
    async-for iteration the same way, so this one function drives either
    — the hub side is handled exactly like any other local client.
    `peer` is a label for logging only ("" for the hub, since there's no
    per-request remote address there)."""
    global module_mode
    await _send_ws_snapshot(ws)

    try:
        async for msg in ws:
            if msg.type != web.WSMsgType.TEXT:
                continue
            try:
                cmd = json.loads(msg.data)
            except json.JSONDecodeError:
                continue

            if cmd.get("__hub_client_connected__"):
                await _send_ws_snapshot(ws)
                continue
            if "__alexa__" in cmd:
                if ws is _hub_agent_ws:
                    asyncio.create_task(alexa_skill_request(ws, cmd["__alexa__"]))
                continue
            if "__http__" in cmd:
                if ws is _hub_agent_ws:   # only the remote link carries these
                    asyncio.create_task(_relay_http(ws, cmd["__http__"]))
                continue

            action = cmd.get("action")
            result = None

            if action == "client_info":
                log.info("Screen %sx%s dpr=%s %s | %s | %s", cmd.get("w"), cmd.get("h"), cmd.get("dpr"),
                         peer, " ".join(cmd.get("btns") or []), (cmd.get("ua") or "")[:90])
                continue
            if action == "connect":
                if cmd.get("machine"):
                    resp = await select_machine(cmd["machine"])
                else:
                    resp = await handle_connect_action()
                await ws.send_json({"type": "connect_result", "data": resp})
                await broadcast({"type": "state", "data": state.to_dict()})
                continue
            elif action == "scan_devices":
                try:
                    resp = await scan_devices()
                except Exception as e:
                    log.warning("Device scan failed: %s", e)
                    resp = {"ok": False, "error": str(e), "devices": []}
                await ws.send_json({"type": "devices", "data": resp})
                continue
            elif action == "disconnect":
                global _ble_scanning
                _ble_scanning = False
                if ble_client and ble_client.is_connected:
                    await ble_client.disconnect()
                state.link = "disconnected"
                await broadcast({"type": "state", "data": state.to_dict()})
                continue
            elif demo_state is not None and action in ("pause", "resume", "stop", "tare"):
                await demo_control(action)
            elif action == "select_recipe":
                try:
                    ALEXA_SELECTED_FILE.write_text(json.dumps({"name": cmd.get("name", "")}))
                except Exception:
                    pass
                continue
            elif action == "tank_set":
                try:
                    tank.ml = max(0.0, min(tank.cap, float(cmd.get("ml", tank.ml))))
                    tank.save(force=True)
                    brewlog.add_tank_event(tank.ml)
                except (TypeError, ValueError):
                    pass
                await broadcast({"type": "state", "data": state_payload()})
                continue
            elif action == "tank_refill":
                tank.refill()
                if state.fault == "Out of water":
                    state.fault = ""
                await broadcast({"type": "state", "data": state_payload()})
                continue
            elif action == "wake":
                if not state.brew_active:
                    result = await send_frame(build_frame(CMD_HANDSHAKE, [185, 1]))
            elif action == "tare":
                result = await send_frame(frame_tare())
            elif action == "pause":
                brew_session["user_paused"] = True
                if state.brew_active:
                    state.activity, state.waiting = "Paused", False
                result = await send_confirmed(frame_pause())
            elif action == "resume":
                brew_session["user_paused"] = False
                if state.brew_active:
                    state.activity = "Brewing"
                result = await send_confirmed(frame_resume())
            elif action == "stop":
                brew_session["user_stopped"] = True
                result = await send_confirmed(frame_stop())
            elif action == "skip_grind":
                result = await skip_grind_and_brew(cmd.get("recipe"))
            elif action == "load_recipe":
                recipe = cmd.get("recipe")
                if recipe:
                    await leave_modules()
                    await reset_for_brew(recipe)
                    await asyncio.sleep(0.3)
                    for f in build_load_frames(recipe):
                        result = await send_confirmed(f)
                        if result:
                            break
            elif action == "execute":
                result = await send_confirmed(frame_execute())
            elif action == "quit_recipe":
                result = await send_confirmed(frame_quit_recipe())
            elif action == "grinder_enter":
                module_mode = "grinder"
                size = cmd.get("size", 40)
                rpm = cmd.get("rpm", 90)
                result = await send_frame(frame_grinder_enter(size, rpm))
            elif action == "grinder_start":
                module_mode = "grinder"
                module_run_grind_start()
                size = cmd.get("size", 40)
                rpm = cmd.get("rpm", 90)
                result = await send_frame(frame_grinder_start(size, rpm))
            elif action == "grinder_stop":
                if module_run and module_run["mode"] == "grind":
                    module_run["end"] = time.time()
                    end_module_run()
                result = await send_frame(frame_grinder_stop())
            elif action == "brewer_enter":
                module_mode = "brewer"
                pat = pattern_to_byte(cmd.get("pattern", PAT_SPIRAL))
                temp = cmd.get("temp_c", 93)
                result = await send_frame(frame_brewer_enter(pat, temp))
            elif action == "brewer_start":
                module_mode = "brewer"
                pat = pattern_to_byte(cmd.get("pattern", PAT_SPIRAL))
                result = await send_frame(frame_brewer_start(
                    cmd.get("flow", 3.0), cmd.get("volume_ml", 100),
                    cmd.get("temp_c", 93), pat
                ))
            elif action == "brewer_stop":
                result = await send_frame(frame_brewer_stop())
            elif action == "scale_enter":
                module_mode = "scale"
                result = await send_frame(frame_scale_enter())
            elif action == "quit_module":
                module_mode = ""
                if _alexa_grind_task and not _alexa_grind_task.done():
                    _alexa_grind_task.cancel()
                end_module_run()
                mod = cmd.get("module", "")
                # stop the module's operation first, then leave the screen; retry the quit so the
                # machine never stays stuck on the module screen if a BLE write is dropped.
                if mod == "grinder":
                    await send_frame(frame_grinder_stop())
                    await asyncio.sleep(0.3)
                    quit_frame = frame_quit_grinder()
                elif mod == "brewer":
                    await send_frame(frame_brewer_stop())
                    await asyncio.sleep(0.3)
                    quit_frame = frame_quit_brewer()
                elif mod == "scale":
                    quit_frame = frame_quit_scale()
                else:
                    quit_frame = None
                if quit_frame is not None:
                    for attempt in range(2):
                        result = await send_frame(quit_frame)
                        await asyncio.sleep(0.4)
                        if state.activity_code in (0, 1):   # back on the home screen
                            result = None
                            break

            if result:
                await ws.send_json({"type": "error", "msg": result})
            else:
                await ws.send_json({"type": "ok", "action": action})

    except Exception as e:
        log.info(f"WebSocket closed: {e}")


async def handle_ws(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    ws_clients.add(ws)
    log.info(f"WebSocket client connected ({len(ws_clients)} total)")
    try:
        await _run_ws_session(ws, peer=request.remote)
    finally:
        ws_clients.discard(ws)
        log.info(f"WebSocket client disconnected ({len(ws_clients)} total)")
    return ws


async def handle_state(request):
    return web.json_response(state.to_dict())


# Cloud API endpoints
async def handle_cloud_login(request):
    body = await request.json()
    email = body.get("email", "")
    password = body.get("password", "")
    if not email or not password:
        return web.json_response({"ok": False, "error": "Email and password required"})
    result = await cloud_login(email, password)
    if result.get("ok"):
        recipes = await cloud_fetch_recipes()
        await broadcast({"type": "recipes", "data": _all_recipes()})
        await broadcast({"type": "cloud_status", "data": {
            "signed_in": True, "email": cloud_email,
        }})
    return web.json_response(result)


async def handle_cloud_sync(request):
    if not cloud_token:
        return web.json_response({"ok": False, "error": "Not signed in"})
    recipes = await cloud_fetch_recipes()
    await broadcast({"type": "recipes", "data": _all_recipes()})
    return web.json_response({"ok": True, "count": len(recipes)})


async def handle_cloud_logout(request):
    global cloud_token, cloud_member_id, cloud_email, cloud_recipes
    cloud_token = ""
    cloud_member_id = 0
    cloud_email = ""
    cloud_recipes = []
    save_config()
    await broadcast({"type": "recipes", "data": _all_recipes()})
    await broadcast({"type": "cloud_status", "data": {"signed_in": False, "email": ""}})
    return web.json_response({"ok": True})


async def handle_cloud_status(request):
    return web.json_response({
        "signed_in": bool(cloud_token and cloud_member_id),
        "email": cloud_email,
    })


# Schedule API endpoints
async def handle_schedules_get(request):
    return web.json_response(schedules)


async def handle_schedules_post(request):
    body = await request.json()
    sched = {
        "id": int(time.time() * 1000) % 1000000,
        "name": body.get("name", "My Brew"),
        "time": body.get("time", "07:00"),
        "days": body.get("days", [0, 1, 2, 3, 4]),
        "date": body.get("date") or None,
        "recipe_name": body.get("recipe_name", ""),
        "recipe": body.get("recipe"),
        "enabled": body.get("enabled", True),
    }
    schedules.append(sched)
    save_schedules()
    await broadcast({"type": "schedules", "data": schedules})
    return web.json_response({"ok": True, "schedule": sched})


async def handle_schedules_put(request):
    sid = int(request.match_info["id"])
    body = await request.json()
    for s in schedules:
        if s["id"] == sid:
            for k in ("name", "time", "days", "date", "recipe_name", "recipe", "enabled"):
                if k in body:
                    s[k] = body[k]
            save_schedules()
            await broadcast({"type": "schedules", "data": schedules})
            return web.json_response({"ok": True, "schedule": s})
    return web.json_response({"ok": False, "error": "Not found"}, status=404)


async def handle_schedules_delete(request):
    sid = int(request.match_info["id"])
    for i, s in enumerate(schedules):
        if s["id"] == sid:
            schedules.pop(i)
            save_schedules()
            await broadcast({"type": "schedules", "data": schedules})
            return web.json_response({"ok": True})
    return web.json_response({"ok": False, "error": "Not found"}, status=404)


# ---------------------------------------------------------------------------
# App startup
# ---------------------------------------------------------------------------
async def cloud_agent_loop():
    """When this app is signed in to a Nuqta Cloud hub and the account is
    active, keeps an outbound connection open to it so a phone away from
    home can reach this dashboard, and so brew-done pushes can go through
    the hub. Does nothing (just sleeps) when not configured, or when the
    account isn't active — cheap to always have running."""
    global _hub_agent_ws, _hub_wake
    _hub_wake = asyncio.Event()

    async def nap(seconds):
        try:
            await asyncio.wait_for(_hub_wake.wait(), seconds)
        except asyncio.TimeoutError:
            pass
        _hub_wake.clear()

    backoff = 2
    while True:
        try:
            if not hub_client.hub.configured:
                await nap(30)
                continue
            status = await hub_client.hub.account_status()
            if not status.get("active"):
                await nap(60)
                continue

            async with hub_client.session() as http:
                async with http.ws_connect(hub_client.hub.agent_ws_url(), heartbeat=30) as ws:
                    _hub_agent_ws = ws
                    ws_clients.add(ws)
                    log.info("Nuqta Cloud: connected to hub — remote access is on")
                    backoff = 2
                    try:
                        await _run_ws_session(ws)
                    finally:
                        ws_clients.discard(ws)
                        _hub_agent_ws = None
                        log.info("Nuqta Cloud: disconnected from hub")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning("Nuqta Cloud: hub connection failed (%s) — retrying in %ss", e, backoff)

        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 60)


async def on_startup(app):
    global main_loop, cloud_session
    main_loop = asyncio.get_running_loop()
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    cloud_session = aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(ssl=ssl_ctx),
    )
    load_config()
    load_schedules()
    load_recipe_tags()
    state.link = "disconnected"
    app["sched_task"] = asyncio.create_task(schedule_checker())
    app["build_watch"] = asyncio.create_task(watch_dashboard_build())
    app["weather"] = asyncio.create_task(watch_weather())
    app["hub_agent"] = asyncio.create_task(cloud_agent_loop())
    app["pro"] = asyncio.create_task(pro_loop())
    # reconnect to the machine picked last time (after a restart nobody has to tap "connect")
    if machine_chosen and not os.environ.get("NUQTA_NO_BLE"):
        log.info("Reconnecting to %s", preferred_machine)
        asyncio.create_task(handle_connect_action())
    if cloud_token and cloud_member_id:
        asyncio.create_task(cloud_fetch_recipes())


async def on_cleanup(app):
    global _ble_scanning
    _ble_scanning = False
    app["sched_task"].cancel()
    app["build_watch"].cancel()
    app["weather"].cancel()
    if ble_client and ble_client.is_connected:
        await ble_client.disconnect()
    if cloud_session:
        await cloud_session.close()


# ---------------------------------------------------------------------------
# Alexa / HTTP action endpoints (used by fauxmo)
# ---------------------------------------------------------------------------
alexa_flags = {"water": False, "grind": False}
_alexa_grind_task = None


async def _alexa_grind_off():
    global module_mode
    alexa_flags["grind"] = False
    if module_run and module_run["mode"] == "grind":
        module_run["end"] = time.time()
        end_module_run()
    result = await send_frame(frame_grinder_stop())
    await asyncio.sleep(0.3)
    await send_frame(frame_quit_grinder())
    module_mode = ""
    return result


async def _alexa_grind_autostop():
    secs = voice_safety()["grind_s"]
    await asyncio.sleep(secs)
    log.info("Alexa grinder: auto-stop after %ss", secs)
    await _alexa_grind_off()


async def _voice_action(action: str, want: str | None = None):
    """Carry out one voice/shortcut action. Returns the same JSON response the helper expects."""
    result = None

    global module_mode, _alexa_grind_task
    if action == "brew":
        recipe = next((r for r in _all_recipes() if r.get("name") == want), None) if want else alexa_selected_recipe()
        if not recipe:
            return web.json_response({"ok": False, "error": "No recipes loaded"})
        if state.brew_active:
            return web.json_response({"ok": False, "error": "A brew is already running"})
        result = await _load_and_start(recipe)
        if result:
            return web.json_response({"ok": False, "error": result})
        return web.json_response({"ok": True, "recipe": recipe.get("name")})

    elif action == "tare":
        result = await send_frame(frame_tare())
    elif action == "wake":
        if not state.brew_active:
            result = await send_frame(build_frame(CMD_HANDSHAKE, [185, 1]))
    elif action == "stop":
        brew_session["user_stopped"] = True
        result = await send_confirmed(frame_stop())
    elif action == "pause":
        brew_session["user_paused"] = True
        result = await send_confirmed(frame_pause())
    elif action == "resume":
        brew_session["user_paused"] = False
        result = await send_confirmed(frame_resume())
    elif action == "water":
        if state.brew_active:
            return web.json_response({"ok": False, "error": "A brew is running"})
        module_mode = "brewer"
        w_ml, w_temp = voice_safety()["water_ml"], voice_safety()["water_temp"]
        result = await send_frame(frame_brewer_enter(pattern_to_byte(PAT_SPIRAL), w_temp))
        await asyncio.sleep(0.5)
        result = result or await send_frame(frame_brewer_start(3.0, w_ml, w_temp, pattern_to_byte(PAT_SPIRAL)))
        alexa_flags["water"] = not result
        if not result:
            return web.json_response({"ok": True})
    elif action == "water_stop":
        if alexa_flags["water"] or module_mode == "brewer" or state.activity_code in (3, 35):
            alexa_flags["water"] = False
            result = await send_frame(frame_brewer_stop())
            await asyncio.sleep(0.4)
            for _ in range(3):
                asked = time.time()
                await send_frame(frame_quit_brewer())
                if await _wait_until(lambda: _brewer_quit_seen >= asked, 1.2, 0.1):
                    break
        alexa_flags["water"] = False
        module_mode = ""
    elif action in ("grind", "grind_stop"):
        if action == "grind":
            if state.brew_active:
                return web.json_response({"ok": False, "error": "A brew is running"})
            r = alexa_selected_recipe() or {}
            size = r.get("grind_size") or 48
            rpm = r.get("rpm") or 100
            module_mode = "grinder"
            result = await send_frame(frame_grinder_enter(size, rpm))
            await asyncio.sleep(0.5)
            result = result or await send_frame(frame_grinder_start(size, rpm))
            alexa_flags["grind"] = not result
            if not result:
                module_run_grind_start()
            if not result:
                if _alexa_grind_task and not _alexa_grind_task.done():
                    _alexa_grind_task.cancel()
                _alexa_grind_task = asyncio.create_task(_alexa_grind_autostop())
        else:
            if _alexa_grind_task and not _alexa_grind_task.done():
                _alexa_grind_task.cancel()
            result = await _alexa_grind_off()
    elif action == "connect":
        resp = await handle_connect_action()
        return web.json_response(resp)
    else:
        return web.json_response({"ok": False, "error": "Unknown action"}, status=400)

    if result:
        return web.json_response({"ok": False, "error": result})
    return web.json_response({"ok": True})


# ---------------------------------------------------------------------------
# Voice control: settings, activity log and the page's API
# ---------------------------------------------------------------------------
VOICE_FILE = Path(__file__).parent / "voice.json"
VOICE_LOG_FILE = Path(__file__).parent / "voice_log.json"
VOICE_DEVICE_KEYS = ("coffee", "pause", "water", "grind", "scale", "wake")
VOICE_ACTION_DEVICE = {"brew": "coffee", "stop": "coffee", "pause": "pause", "resume": "pause",
                       "water": "water", "water_stop": "water", "grind": "grind", "grind_stop": "grind",
                       "tare": "scale", "wake": "wake"}
VOICE_SHORTCUTS = {"brew": "brew", "stop": "stop", "pause": "pause", "resume": "resume", "tare": "tare",
                   "wake": "wake", "hot-water": "water", "hot-water-stop": "water_stop",
                   "grind": "grind", "grind-stop": "grind_stop"}
VOICE_SAFETY_DEFAULT = {"ask": False, "grind_s": 20, "water_ml": 200, "water_temp": 93}
VOICE_SAFETY_RANGE = {"grind_s": (5, 60), "water_ml": (30, 500), "water_temp": (40, 98)}
SPEAKABLE_RE = re.compile(r"[A-Za-z0-9]+(?: [A-Za-z0-9]+)*")
ARABIC_RE = re.compile(r"[\u0600-\u06FF]")


def _voice_load() -> dict:
    v = {"enabled": False, "devices": {}, "recipes": None, "default": "", "safety": {}}
    try:
        v.update(json.loads(VOICE_FILE.read_text()))
    except Exception:
        pass
    return v


_voice = _voice_load()
try:
    _voice_log: list = json.loads(VOICE_LOG_FILE.read_text())
except Exception:
    _voice_log = []
_voice_pending: dict | None = None   # a voice brew waiting for "yes" on the dashboard
_voice_device_names: list = []


def _voice_save() -> None:
    try:
        VOICE_FILE.write_text(json.dumps(_voice, indent=2, ensure_ascii=False))
    except Exception as e:
        log.warning("Couldn't save voice settings: %s", e)


def voice_safety() -> dict:
    """Safety options. They are a Pro feature: without Pro the built-in defaults apply."""
    out = dict(VOICE_SAFETY_DEFAULT)
    if pro_active():
        for k, v in (_voice.get("safety") or {}).items():
            if k in out:
                out[k] = v
    return out


def voice_device_on(key: str) -> bool:
    if not pro_active():
        return True          # free: the six basic devices, all or nothing (the main switch)
    return bool((_voice.get("devices") or {}).get(key, False))   # Pro: only what was chosen


def voice_problem(voice: str, recipe_name: str = "") -> str:
    """'' when Alexa can say it; otherwise why not."""
    v = (voice or "").strip()
    if v and SPEAKABLE_RE.fullmatch(v):
        return ""
    if ARABIC_RE.search(v or recipe_name or ""):
        return "arabic"
    return "emoji" if v else "empty"


def voice_recipe_slots() -> list:
    """Up to 10 recipes that get their own voice command, in the user's order."""
    recipes = [r.get("name", "") for r in _all_recipes() if r.get("name")]
    stored = _voice.get("recipes") if pro_active() else None
    slots, seen = [], set()
    for it in stored or []:
        n = it.get("name")
        if n in recipes and n not in seen:
            seen.add(n)
            slots.append({"name": n, "voice": (it.get("voice") or "").strip(), "on": bool(it.get("on"))})
    for n in recipes:
        if n in seen:
            continue
        seen.add(n)
        auto = "" if ARABIC_RE.search(n) else n
        slots.append({"name": n, "voice": auto, "on": False})   # a recipe is only sent to Alexa once it's chosen
    slots = slots[:10]
    used = set()
    for sl in slots:
        sl["problem"] = voice_problem(sl["voice"], sl["name"])
        dup = sl["voice"].lower() in used
        if sl["problem"] or dup:
            sl["on"] = False
            if dup and not sl["problem"]:
                sl["problem"] = "duplicate"
        elif sl["on"]:
            used.add(sl["voice"].lower())
    return slots


def voice_log_add(source: str, action: str, recipe: str | None, ok: bool, reason: str = "") -> None:
    _voice_log.insert(0, {"ts": int(time.time()), "source": source, "action": action,
                          "recipe": recipe or "", "ok": bool(ok), "reason": reason})
    del _voice_log[100:]
    try:
        VOICE_LOG_FILE.write_text(json.dumps(_voice_log, ensure_ascii=False))
    except Exception:
        pass


def _voice_reason(err: str) -> str:
    e = (err or "").lower()
    if "already running" in e or "brew is running" in e:
        return "brew_running"
    if "not connected" in e or "disconnected" in e:
        return "not_connected"
    if "no recipes" in e:
        return "no_recipe"
    return err or ""


async def _voice_run(action: str, want: str | None, source: str):
    """Run an action and record it in the activity log."""
    recipe_name = None
    if action == "brew":
        r = next((x for x in _all_recipes() if x.get("name") == want), None) if want else alexa_selected_recipe()
        recipe_name = (r or {}).get("name")
    try:
        resp = await _voice_action(action, want)
        data = json.loads(resp.text or "{}")
    except Exception as e:
        resp, data = web.json_response({"ok": False, "error": str(e)}), {"ok": False, "error": str(e)}
    ok = bool(data.get("ok"))
    voice_log_add(source, action, recipe_name, ok, _voice_reason(data.get("error", "")))
    if ok:
        sel = alexa_selected_recipe() or {}
        await broadcast({"type": "voice_action", "action": action, "source": source, "recipe": recipe_name,
                         "safety": voice_safety(), "grind": {"size": sel.get("grind_size") or 48, "rpm": sel.get("rpm") or 100}})
    else:
        await broadcast({"type": "voice_action", "action": action, "source": source, "recipe": recipe_name,
                         "refused": _voice_reason(data.get("error", ""))})
    await broadcast({"type": "voice"})
    return resp


async def _voice_entry(request, action: str, source: str):
    global _voice_pending
    want = request.query.get("recipe")

    def refuse(reason: str, status: int = 200):
        voice_log_add(source, action, want, False, reason)
        return web.json_response({"ok": False, "error": reason}, status=status)

    if action == "connect":
        return web.json_response(await handle_connect_action())
    if action not in VOICE_ACTION_DEVICE:
        return web.json_response({"ok": False, "error": "Unknown action"}, status=400)
    if not _voice.get("enabled", False):
        r = refuse("voice_off")
        await broadcast({"type": "voice"})
        return r
    if not voice_device_on(VOICE_ACTION_DEVICE[action]):
        r = refuse("device_off")
        await broadcast({"type": "voice"})
        return r
    if action == "brew" and voice_safety()["ask"]:
        recipe = next((x for x in _all_recipes() if x.get("name") == want), None) if want else alexa_selected_recipe()
        if recipe and not state.brew_active and _is_connected():
            _voice_pending = {"recipe": recipe.get("name"), "source": source, "ts": time.time()}
            await broadcast({"type": "voice_confirm", "recipe": recipe.get("name"), "source": source})
            return web.json_response({"ok": True, "waiting": True})
    return await _voice_run(action, want, source)


async def handle_alexa_action(request):
    return await _voice_entry(request, request.match_info["action"], "alexa")


async def handle_voice_shortcut(request):
    """Plain addresses for Apple Shortcuts, Siri, NFC tags and Home Assistant (Pro)."""
    action = VOICE_SHORTCUTS.get(request.match_info["action"])
    if not action:
        return web.json_response({"ok": False, "error": "Unknown action"}, status=404)
    # a web page must not be able to fire these behind the user's back
    if request.headers.get("Sec-Fetch-Site", "none") not in ("none", "same-origin"):
        return web.json_response({"ok": False, "error": "cross_origin"}, status=403)
    if not pro_active():
        return web.json_response({"ok": False, "error": "pro_required"}, status=402)
    # Opened as a page in a browser (address bar, a restored tab, an NFC tag): ask first.
    # A tab that reloads by itself must never start a brew. Shortcuts and other apps
    # send no such header and run straight away.
    if request.method == "GET" and request.headers.get("Sec-Fetch-Dest") == "document":
        label = html_escape(request.match_info["action"].replace("-", " ").title())
        page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Nuqta · {label}</title>
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#12100E;color:#F3EDE4;font-family:-apple-system,'Segoe UI',sans-serif}}
form{{text-align:center;padding:24px}}h1{{font-size:22px;margin:0 0 6px}}p{{color:#A89E93;font-size:14px;margin:0 0 20px}}
button{{height:52px;padding:0 36px;border:0;border-radius:16px;background:#E3925A;color:#1A120B;font-size:17px;font-weight:700}}</style></head>
<body><form method="post"><h1>{label}</h1><p>Nuqta · tap to run this on your machine</p><button>Run now</button></form></body></html>"""
        return web.Response(text=page, content_type="text/html", headers={"Cache-Control": "no-store"})
    resp = await _voice_entry(request, action, "shortcut")
    if request.method == "POST" and request.headers.get("Sec-Fetch-Dest") == "document":
        ok = json.loads(resp.text or "{}").get("ok")
        return web.Response(text=f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#12100E;color:#F3EDE4;font-family:-apple-system,sans-serif;font-size:20px'>{'Done ✓' if ok else 'Refused — see the Voice log in Nuqta'}</body>",
                            content_type="text/html", headers={"Cache-Control": "no-store"})
    return resp


async def handle_voice_confirm(request):
    """The dashboard's answer to "Is your cup in place?" for a waiting voice brew."""
    global _voice_pending
    try:
        body = await request.json()
    except Exception:
        body = {}
    pending, _voice_pending = _voice_pending, None
    await broadcast({"type": "voice_confirm", "recipe": None})
    if not pending or time.time() - pending["ts"] > 120:
        return web.json_response({"ok": False, "error": "nothing_waiting"})
    if not body.get("approve"):
        voice_log_add(pending["source"], "brew", pending["recipe"], False, "cancelled")
        await broadcast({"type": "voice"})
        return web.json_response({"ok": True})
    resp = await _voice_run("brew", pending["recipe"], pending["source"])
    return resp


_ALEXA_LOG_RE = re.compile(
    r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) .*?INFO\s+(setup\.xml requested by Echo|Attempting to get state for (.+)|Attempting to turn (on|off) (.+))$",
    re.M)


def voice_alexa_seen() -> dict:
    """When an Alexa speaker last read the devices, checked one, or sent a command."""
    return dict(_hue_seen)


def voice_needs_discover() -> bool:
    """True when the devices differ from the set Alexa last discovered (as far as we know)."""
    if not _voice.get("enabled", False) or not _voice_device_names:
        return False
    known = _voice.get("known_names")
    if known is None:            # first time: assume Alexa already has today's set
        _voice["known_names"] = sorted(_voice_device_names)
        _voice_save()
        return False
    return sorted(_voice_device_names) != sorted(known)


def voice_payload() -> dict:
    ip = get_local_ip()
    import socket
    bases = [f"http://{ip}:{_alexa_port}"]
    host = socket.gethostname().split(".")[0]
    if host:
        bases.append(f"http://{host}.local:{_alexa_port}")
    pro = pro_active()
    states = {"coffee": state.brew_active, "pause": state.brew_active and state.activity == "Paused",
              "water": alexa_flags["water"] and module_mode == "brewer",
              "grind": alexa_flags["grind"] and module_mode == "grinder"}
    default = (alexa_selected_recipe() or {}).get("name", "")
    return {
        "pro": pro,
        "enabled": bool(_voice.get("enabled", False)),
        "helper": matter_available(),
        "matter": {"code": _matter["pairing"].get("manual", ""), "qr": _matter["pairing"].get("qr", ""), "paired": bool(_matter["pairing"].get("commissioned")),
                   "window": bool(_matter["pairing"].get("window")), "apps": _matter["pairing"].get("fabrics", []),
                   "running": bool(_matter.get("proc") and _matter["proc"].poll() is None)},
        "count": len(_voice_device_names) if _voice.get("enabled", False) else 0,
        "devices": [{"key": k, "enabled": voice_device_on(k),
                     "state": "momentary" if k in ("scale", "wake") else ("on" if states.get(k) else "off")}
                    for k in VOICE_DEVICE_KEYS],
        "recipes": voice_recipe_slots(),
        "all_recipes": [r.get("name", "") for r in _all_recipes() if r.get("name")],
        "default": default,
        "safety": voice_safety(),
        "log": _voice_log[:50] if pro else _voice_log[:1],
        "needs_discover": voice_needs_discover(),
        "bases": bases,
        "alexa": voice_alexa_seen(),
        "names": list(_voice_device_names),
        "gen": int(_voice.get("gen") or 0),
        "pending": (_voice_pending or {}).get("recipe"),
    }


async def handle_voice_get(request):
    return web.json_response(voice_payload())


async def handle_voice_post(request):
    try:
        b = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "bad_json"}, status=400)
    restart = False
    if "enabled" in b:
        _voice["enabled"] = bool(b["enabled"])
        restart = True
    if b.get("discovered"):
        _voice["known_names"] = sorted(_voice_device_names)
    if b.get("rediscover"):
        restart = True
    if b.get("pair_another"):
        _matter["open_req"] = int(time.time() * 1000)   # the bridge opens pairing on its next check
    if b.get("fresh"):
        # new identities for every device: Alexa adds them as new on its next discovery
        _voice["gen"] = int(_voice.get("gen") or 0) + 1
        _voice["known_names"] = []
        restart = True
    pro_keys = ("device", "recipes", "default", "safety", "pair_another")
    if any(k in b for k in pro_keys) and not pro_active():
        return web.json_response({"ok": False, "error": "pro_required"}, status=402)
    if "device" in b:
        d = b["device"] or {}
        if d.get("key") in VOICE_DEVICE_KEYS:
            _voice.setdefault("devices", {})[d["key"]] = bool(d.get("enabled"))
            restart = True
    if "recipes" in b and isinstance(b["recipes"], list):
        _voice["recipes"] = [{"name": str(r.get("name", "")), "voice": str(r.get("voice", "")).strip()[:40],
                              "on": bool(r.get("on"))} for r in b["recipes"][:10] if r.get("name")]
        restart = True
    if "default" in b:
        _voice["default"] = str(b["default"])
        try:
            ALEXA_SELECTED_FILE.write_text(json.dumps({"name": _voice["default"]}))
        except Exception:
            pass
    if "safety" in b and isinstance(b["safety"], dict):
        cur = dict(VOICE_SAFETY_DEFAULT, **(_voice.get("safety") or {}))
        for k, v in b["safety"].items():
            if k == "ask":
                cur["ask"] = bool(v)
            elif k in VOICE_SAFETY_RANGE:
                lo, hi = VOICE_SAFETY_RANGE[k]
                try:
                    cur[k] = max(lo, min(hi, int(v)))
                except (TypeError, ValueError):
                    pass
        _voice["safety"] = cur
    _voice_save()
    if restart:
        await asyncio.get_running_loop().run_in_executor(None, start_fauxmo, _alexa_port)
    await broadcast({"type": "voice"})
    return web.json_response({"ok": True, **voice_payload()})


# ---------------------------------------------------------------------------
# Server restart
# ---------------------------------------------------------------------------
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
DASHBOARD_HTML = Path(__file__).resolve().parent / "dashboard.html"


def dashboard_build_id() -> int:
    """Changes whenever dashboard.html is rebuilt; open screens reload when it changes."""
    try:
        return int(DASHBOARD_HTML.stat().st_mtime)
    except OSError:
        return 0


def _frontend_changed() -> bool:
    src = FRONTEND_DIR / "src"
    if not src.is_dir():
        return False
    newest = max((f.stat().st_mtime for f in src.rglob("*") if f.is_file()), default=0)
    newest = max(newest, (FRONTEND_DIR / "index.html").stat().st_mtime if (FRONTEND_DIR / "index.html").exists() else 0)
    return newest > dashboard_build_id()


async def _rebuild_dashboard() -> bool:
    """npm run build in frontend/ (writes dashboard.html). Returns True when it built."""
    import shutil
    npm = shutil.which("npm")
    if not npm:
        log.warning("Restart: npm not found, keeping the current dashboard")
        return False
    log.info("Restart: rebuilding the dashboard…")
    await broadcast({"type": "toast", "msg": "Updating the dashboard…"})
    try:
        proc = await asyncio.create_subprocess_exec(
            npm, "run", "build", cwd=str(FRONTEND_DIR),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
    except Exception as e:
        log.error("Restart: build failed to run: %s", e)
        return False
    if proc.returncode != 0:
        log.error("Restart: build failed:\n%s", out.decode(errors="replace")[-2000:])
        await broadcast({"type": "toast", "msg": "Dashboard build failed — keeping the current one", "level": "error"})
        return False
    log.info("Restart: dashboard rebuilt")
    return True


async def _restart_soon():
    await asyncio.sleep(0.2)
    if _frontend_changed():
        await _rebuild_dashboard()
    await broadcast({"type": "server_restarting"})
    await asyncio.sleep(0.4)
    log.info("Restarting server…")
    os.execv(sys.executable, [sys.executable, "-u"] + sys.argv)


# ---------------------------------------------------------------------------
# Brew log API (analytics-spec §1): brews, ★ ratings, bean bags
# ---------------------------------------------------------------------------
async def handle_brews_get(request):
    mode = request.query.get("mode")
    return web.json_response({"brews": brewlog.brews(request.query.get("from"), request.query.get("to"), mode),
                              "schema": brewlog.version()})


async def handle_brew_rate(request):
    body = await request.json()
    rating = body.get("rating")
    try:
        ok = brewlog.rate(request.match_info["id"], int(rating) if rating else None, (body.get("note") or "").strip()[:500])
    except ValueError as e:
        return web.json_response({"ok": False, "error": str(e)}, status=400)
    if ok:
        on_brew_log_changed()
        await broadcast({"type": "brew_rated", "data": {"id": request.match_info["id"], "rating": rating}})
    return web.json_response({"ok": ok})


async def handle_brew_curves(request):
    """GET /api/brews/curves?recipe=NAME → best-rated and latest water-vs-time curves of that recipe."""
    name = request.query.get("recipe", "")
    return web.json_response(brewlog.curves(name) if name else {"best": None, "last": None})


async def handle_bags_get(request):
    return web.json_response({"bags": brewlog.bags(), "active": brewlog.active_bag()})


async def handle_bags_post(request):
    b = await request.json()
    try:
        bid = brewlog.add_bag(name=str(b["name"])[:80], bag_g=float(b["bag_g"]),
                              price_sar=float(b["price_sar"]) if b.get("price_sar") not in (None, "") else None,
                              roast_date=b.get("roast_date") or None, active=b.get("active", True))
    except (KeyError, ValueError) as e:
        return web.json_response({"ok": False, "error": f"bad field: {e}"}, status=400)
    on_brew_log_changed()
    return web.json_response({"ok": True, "id": bid})


async def handle_bag_patch(request):
    b = await request.json()
    ok = brewlog.update_bag(request.match_info["id"], **b)
    on_brew_log_changed()
    return web.json_response({"ok": ok})


_analytics_cache: dict = {}
ANALYTICS_TTL_S = 60


def on_brew_log_changed():
    """The brew log changed (brew finished, rating, bag): drop cached analytics."""
    _analytics_cache.clear()


async def handle_analytics(request):
    """GET /api/analytics?from&to — every analytics widget in one JSON (analytics-spec §2)."""
    if not pro_active():
        return web.json_response({"error": "pro_required"}, status=402)
    if not HAS_ANALYTICS:
        return web.json_response({"error": "analytics not available"}, status=404)
    import analytics
    since, to = request.query.get("from"), request.query.get("to")
    key = (since, to)
    hit = _analytics_cache.get(key)
    if hit and time.time() - hit[0] < ANALYTICS_TTL_S:
        return web.json_response(hit[1])
    try:
        now = datetime.fromisoformat(to) if to else None
        if now and now.tzinfo is None:
            now = now.replace(tzinfo=timezone(timedelta(hours=3)))
    except ValueError:
        return web.json_response({"error": "bad 'to' date"}, status=400)
    data = analytics.compute(brewlog, now=now, since=since)
    _analytics_cache[key] = (time.time(), data)
    return web.json_response(data)


# ---------------------------------------------------------------------------
# Web Push: subscribe a phone/tablet so "coffee ready" reaches it when the app is closed
# ---------------------------------------------------------------------------
SERVICE_WORKER = """
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Nuqta', {
    body: d.body || '', tag: d.tag || 'nuqta', icon: '/nuqta-icon-192.png', badge: '/nuqta-icon-192.png',
    renotify: true, data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(e.notification.data.url || '/');
  }));
});
"""


async def handle_service_worker(request):
    return web.Response(text=SERVICE_WORKER, content_type="application/javascript",
                        headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"})


async def handle_capabilities(request):
    """What this build offers, so the dashboard can show only the features that are present."""
    return web.json_response({"analytics": HAS_ANALYTICS and pro_active(), "pro": pro_active(),
                              "push": HAS_PUSH, "cloud": True, "alexa": True, "voice": True})


# ---- Nuqta Cloud (optional remote access / push via a hub) -----------------

async def handle_hub_status(request):
    status = await hub_client.hub.account_status()
    status["connected"] = _hub_agent_ws is not None and not _hub_agent_ws.closed
    return web.json_response(status)


async def handle_hub_request_code(request):
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "bad_json"}, status=400)
    hub_url = str(body.get("hub_url", "")).strip()
    email = str(body.get("email", "")).strip()
    if not email:
        return web.json_response({"ok": False, "error": "missing_fields"}, status=400)
    result = await hub_client.hub.request_code(hub_url, email)
    return web.json_response(result)


async def handle_hub_verify(request):
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "bad_json"}, status=400)
    hub_url = str(body.get("hub_url", "")).strip()
    email = str(body.get("email", "")).strip()
    code = str(body.get("code", "")).strip()
    if not email or not code:
        return web.json_response({"ok": False, "error": "missing_fields"}, status=400)
    result = await hub_client.hub.verify_code(hub_url, email, code)
    if result.get("ok"):
        if _hub_wake is not None:
            _hub_wake.set()  # connect now, not at the agent loop's next 30 s check
        try:
            result["pro"] = await refresh_pro(force=True)
        except Exception as e:
            log.warning("Pro check after sign-in failed: %s", e)
    return web.json_response(result)


async def handle_hub_signout(request):
    hub_client.hub.sign_out()
    if not PRO_OWNER_BUILD:
        _pro["active"] = False
        _pro_state_write(active_at=0)
    if _hub_agent_ws is not None and not _hub_agent_ws.closed:
        await _hub_agent_ws.close()  # drop remote access right away
    if _hub_wake is not None:
        _hub_wake.set()
    return web.json_response({"ok": True})


async def handle_push_key(request):
    return web.json_response({"enabled": pusher.enabled, "key": pusher.public_key, "count": pusher.count()})


async def handle_push_subscribe(request):
    if not pro_active():                      # device notifications are part of Nuqta Pro
        return web.json_response({"ok": False, "error": "pro_required"}, status=402)
    sub = await request.json()
    n = pusher.add(sub)
    return web.json_response({"ok": True, "count": n})


async def handle_push_unsubscribe(request):
    body = await request.json()
    pusher.remove(body.get("endpoint", ""))
    return web.json_response({"ok": True, "count": pusher.count()})


async def handle_push_test(request):
    if not pro_active():
        return web.json_response({"ok": False, "error": "pro_required"}, status=402)
    if not pusher.enabled or not pusher.count():
        return web.json_response({"ok": False, "error": "no subscriptions"}, status=400)
    import asyncio as _a
    n = await _a.get_event_loop().run_in_executor(None, lambda: pusher.send(
        "Nuqta", "اختبار الإشعار · Test notification", "test", "/"))
    return web.json_response({"ok": True, "sent": n})


async def handle_trace(request):
    """POST /api/trace?secs=N: record every machine packet to brew_trace.log for N seconds (diagnostics)."""
    global _trace_all_until
    secs = max(10, min(600, int(request.query.get("secs", 120))))
    _trace_all_until = time.time() + secs
    with open(TRACE_FILE, "a") as fh:
        fh.write(f"--- trace all for {secs}s from {time.strftime('%H:%M:%S')} ---\n")
    return web.json_response({"ok": True, "secs": secs})


async def handle_alexa_state(request):
    """Answer for Alexa's "is it on?" question about the xbloom plug."""
    dev = request.query.get("dev", "brew")
    if dev == "pause":
        on = state.brew_active and state.activity == "Paused"
    elif dev == "water":
        on = alexa_flags["water"] and module_mode == "brewer"
    elif dev == "grind":
        on = alexa_flags["grind"] and module_mode == "grinder"
    else:
        on = state.brew_active
    return web.Response(text="BREWING" if on else "IDLE")


async def handle_restart(request):
    if state.brew_active:
        return web.json_response({"ok": False, "error": "A brew is running — restart after it finishes"})
    await broadcast({"type": "toast", "msg": "Server restarting…"})
    asyncio.create_task(_restart_soon())
    return web.json_response({"ok": True})


async def watch_dashboard_build():
    """Tell open screens when dashboard.html changes, so they reload the new build."""
    last = dashboard_build_id()
    while True:
        await asyncio.sleep(5)
        cur = dashboard_build_id()
        if cur != last:
            last = cur
            log.info("Dashboard rebuilt — asking screens to reload")
            await broadcast({"type": "hello", "build": cur})


# ---------------------------------------------------------------------------
# Fauxmo (Alexa local discovery via WeMo emulation)
# ---------------------------------------------------------------------------
ALEXA_SELECTED_FILE = Path(__file__).parent / "alexa_selected.json"
ALEXA_GRIND_MAX_S = 20      # the grinder runs until told to stop: Alexa's grinder stops itself after this
ALEXA_WATER_ML = 200        # "hot water" plug: pour this much at 93°C
_alexa_port = 8420
_alexa_recipe_names: list = []


def alexa_selected_recipe():
    """The recipe picked on the dashboard (falls back to the first one)."""
    recipes = _all_recipes()
    try:
        name = (_voice.get("default") if pro_active() else "") or json.loads(ALEXA_SELECTED_FILE.read_text()).get("name")
        for r in recipes:
            if r.get("name") == name:
                return r
    except Exception:
        pass
    return recipes[0] if recipes else None


def alexa_name(name: str) -> str:
    """A name Alexa can say: letters, numbers and spaces only."""
    clean = re.sub(r"[^0-9A-Za-z\u0600-\u06FF ]+", " ", name or "")
    return re.sub(r"\s+", " ", clean).strip()


def start_fauxmo(server_port: int):
    """Refresh what's offered to voice assistants and restart the Matter bridge if it changed.
    (Name kept from the older Wemo helper; any of those still running are stopped.)"""
    global _alexa_port, _alexa_recipe_names, _voice_device_names
    _alexa_port = server_port
    import subprocess
    subprocess.run(["pkill", "-f", "voice_helper.py -c"], check=False)
    subprocess.run(["pkill", "-f", "fauxmo -c .*xbloom_fauxmo"], check=False)
    _alexa_recipe_names = [r.get("name") for r in _all_recipes()][:10]
    offered = [(e["id"], e["name"]) for e in voice_offered()] if _voice.get("enabled", False) else []
    _voice_device_names = [n for _, n in offered]
    with _matter_lock:            # called from more than one thread: only one bridge, ever
        p = _matter.get("proc")
        running = bool(p and p.poll() is None)
        if offered != _matter.get("offered") or (offered and not running):
            _matter["offered"] = offered
            matter_restart()

# ---------------------------------------------------------------------------
# Weather (Open-Meteo, free, no key): current conditions + today's high/low + next hours.
# Only the city's coordinates are sent. Refreshed every 30 minutes and pushed to the screens.
# ---------------------------------------------------------------------------
WEATHER_CITY = {"ar": "الرياض", "en": "Riyadh", "lat": 24.7136, "lon": 46.6753, "tz": "Asia/Riyadh"}
WEATHER_EVERY_S = 30 * 60
weather_now: dict | None = None

# WMO weather codes → short condition text
_WMO = [
    ((0,), "صافٍ", "Clear"), ((1,), "صافٍ غالباً", "Mostly clear"), ((2,), "غائم جزئياً", "Partly cloudy"),
    ((3,), "غائم", "Overcast"), ((45, 48), "ضباب", "Fog"), ((51, 53, 55, 56, 57), "رذاذ", "Drizzle"),
    ((61, 63, 65, 66, 67, 80, 81, 82), "ممطر", "Rain"), ((71, 73, 75, 77, 85, 86), "ثلج", "Snow"),
    ((95, 96, 99), "عواصف رعدية", "Thunderstorm"),
]


def _wmo_text(code: int) -> dict:
    for codes, ar, en in _WMO:
        if code in codes:
            return {"ar": ar, "en": en}
    return {"ar": "—", "en": "—"}


async def fetch_weather() -> dict | None:
    c = WEATHER_CITY
    url = ("https://api.open-meteo.com/v1/forecast"
           f"?latitude={c['lat']}&longitude={c['lon']}&timezone={c['tz'].replace('/', '%2F')}"
           "&current=temperature_2m,weather_code,is_day&hourly=temperature_2m"
           "&daily=temperature_2m_max,temperature_2m_min&forecast_days=2")
    try:
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())  # Python on macOS has no system CA list
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_ctx)) as s_:
            async with s_.get(url, timeout=aiohttp.ClientTimeout(total=15)) as r:
                d = await r.json()
        cur, daily, hourly = d["current"], d["daily"], d["hourly"]
        now_hour = cur["time"][:13]  # "YYYY-MM-DDTHH"
        idx = next((i for i, t in enumerate(hourly["time"]) if t[:13] >= now_hour), 0)
        hours = [{"time": hourly["time"][i], "temp": round(hourly["temperature_2m"][i])}
                 for i in range(idx + 3, min(idx + 15, len(hourly["time"])), 3)][:4]
        return {
            "city": {"ar": c["ar"], "en": c["en"]},
            "temp": round(cur["temperature_2m"]),
            "cond": _wmo_text(int(cur["weather_code"])),
            "is_day": bool(cur.get("is_day", 1)),
            "hi": round(daily["temperature_2m_max"][0]),
            "lo": round(daily["temperature_2m_min"][0]),
            "hourly": hours,
            "updated": cur["time"],
        }
    except Exception as e:
        log.warning("Weather fetch failed: %s", e)
        return None


async def watch_weather():
    global weather_now
    while True:
        w = await fetch_weather()
        if w:
            weather_now = w
            await broadcast({"type": "weather", "data": w})
            log.info("Weather: %s %s° %s", w["city"]["en"], w["temp"], w["cond"]["en"])
            try:
                local_day = (datetime.now(timezone.utc) + timedelta(hours=3)).strftime("%Y-%m-%d")  # Asia/Riyadh, UTC+3
                brewlog.add_weather_sample(local_day, float(w["temp"]))
            except Exception as e:
                log.warning("Weather log failed: %s", e)
        await asyncio.sleep(WEATHER_EVERY_S if w else 300)


async def handle_weather(request):
    return web.json_response(weather_now or {})



# ---------------------------------------------------------------------------
# Voice devices. Nuqta is a local Matter bridge (matter/bridge.mjs): Alexa,
# Apple Home and Google Home pair with it on the home network with a setup
# code. Only the devices chosen on the Voice page are offered.
# ---------------------------------------------------------------------------
HUE_FIXED_IDS = {"coffee": 1, "pause": 2, "water": 3, "grind": 4, "scale": 5, "wake": 6}
HUE_NAMES = {"coffee": "Coffee", "pause": "Coffee Pause", "water": "Hot Water",
             "grind": "Grinder", "scale": "Scale", "wake": "Coffee Machine"}
HUE_ON = {"coffee": "brew", "pause": "pause", "water": "water", "grind": "grind", "scale": "tare", "wake": "wake"}
HUE_OFF = {"coffee": "stop", "pause": "resume", "water": "water_stop", "grind": "grind_stop"}
_hue_seen = {"read": None, "check": None, "command": None, "command_name": "", "command_on": None, "since": int(time.time())}


ALEXA_LOG = Path(__file__).parent / "alexa.log"


def _hue_trace(msg: str) -> None:
    """One line per Alexa contact, for troubleshooting a speaker that won't connect."""
    try:
        if ALEXA_LOG.exists() and ALEXA_LOG.stat().st_size > 2_000_000:
            ALEXA_LOG.write_text("")
        with open(ALEXA_LOG, "a") as fh:
            fh.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")
    except Exception:
        pass


def _mac_hex() -> str:
    import uuid as _uuid
    return f"{_uuid.getnode():012x}".upper()


def voice_offered() -> list:
    """Everything offered to Alexa (local bridge and the Nuqta skill): the devices
    and recipes chosen on the Voice page, nothing else."""
    out = []
    if not _voice.get("enabled", False):
        return out
    for key in HUE_FIXED_IDS:
        if voice_device_on(key):
            out.append({"id": key, "name": HUE_NAMES[key], "key": key, "recipe": None})
    if pro_active() and voice_device_on("coffee"):
        for sl in voice_recipe_slots():
            if sl["on"] and not sl["problem"]:
                rid = "r" + hashlib.sha1(sl["name"].encode()).hexdigest()[:10]
                out.append({"id": rid, "name": sl["voice"], "key": "coffee", "recipe": sl["name"]})
    return out


MATTER_DIR = Path(__file__).parent / "matter"
_matter = {"proc": None, "pairing": {}, "offered": None}
import threading as _threading
_matter_lock = _threading.Lock()


def _matter_identity() -> dict:
    """Setup code and serial, made once and kept, so a pairing survives restarts."""
    import secrets as _sec
    m = _voice.get("matter") or {}
    bad = {0, 11111111, 22222222, 33333333, 44444444, 55555555, 66666666, 77777777,
           88888888, 99999999, 12345678, 87654321}
    if not m.get("passcode"):
        pc = 0
        while pc in bad:
            pc = _sec.randbelow(99999998) + 1
        m = {"passcode": pc, "discriminator": _sec.randbelow(4096), "serial": "nuqta-" + _sec.token_hex(6)}
        _voice["matter"] = m
        _voice_save()
    return m


def matter_available() -> bool:
    return bool(shutil_which("node")) and (MATTER_DIR / "node_modules" / "@matter" / "main").exists()


def matter_restart() -> None:
    """(Re)start the Matter bridge with the devices currently offered."""
    import subprocess
    p = _matter.get("proc")
    if p and p.poll() is None:
        p.terminate()
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()
    _matter["proc"] = None
    _matter["pairing"] = {}
    # a bridge left by the previous run (a restart replaces this process without
    # stopping its children) still holds the pairing storage: stop it first
    pattern = str(MATTER_DIR / "bridge.mjs")
    subprocess.run(["pkill", "-f", pattern], check=False)
    for _ in range(10):           # a bridge can take a moment to close; then force it
        if subprocess.run(["pgrep", "-f", pattern], capture_output=True).returncode != 0:
            break
        time.sleep(0.3)
    else:
        subprocess.run(["pkill", "-9", "-f", pattern], check=False)
        time.sleep(0.5)
    if os.environ.get("NUQTA_NO_ALEXA") or not _voice.get("enabled", False) or not matter_available():
        return
    _matter_identity()
    env = dict(os.environ, NUQTA_URL=f"http://127.0.0.1:{_alexa_port}",
               MATTER_STORAGE_PATH=str(Path(__file__).parent / "matter_data"), MATTER_LOG_LEVEL="info")
    out = open(ALEXA_LOG, "w")          # fresh log each start, so it can't grow without end
    _matter["proc"] = subprocess.Popen([shutil_which("node"), str(MATTER_DIR / "bridge.mjs")],
                                       cwd=str(MATTER_DIR), env=env, stdout=out, stderr=out)
    import atexit
    atexit.register(lambda: _matter["proc"] and _matter["proc"].poll() is None and _matter["proc"].terminate())
    log.info("Matter bridge started with: %s", ", ".join(e["name"] for e in voice_offered()) or "nothing")


async def handle_reset_modes(request):
    """POST /api/machine/reset-modes (this computer only): leave the water/grinder/scale screens, confirmed."""
    global brewer_dirty
    if request.remote not in ("127.0.0.1", "::1"):
        return web.json_response({"error": "local only"}, status=403)
    if state.brew_active:
        return web.json_response({"ok": False, "error": "brew_running"})
    if not _is_connected():
        return web.json_response({"ok": False, "error": "not_connected"})
    brewer_dirty = True
    await leave_modules()
    return web.json_response({"ok": True, "confirmed": not brewer_dirty, "activity_code": state.activity_code})


async def handle_test_set_volume(request):
    """POST /api/machine/test-volume?ml=N (this computer only, diagnostics): send a water amount from the
    home screen and stop at once if the machine starts pouring. Reports what the machine did."""
    global _trace_all_until
    if request.remote not in ("127.0.0.1", "::1"):
        return web.json_response({"error": "local only"}, status=403)
    if state.brew_active or not _is_connected():
        return web.json_response({"ok": False, "error": "busy_or_offline"})
    ml = max(30, min(500, int(request.query.get("ml", "153"))))
    _trace_all_until = time.time() + 15
    seen = []
    start_code, start_water = state.activity_code, state.water_ml
    await send_frame(frame_brewer_start(3.0, ml, 90, pattern_to_byte(PAT_SPIRAL)))
    poured = False
    t0 = time.time()
    while time.time() - t0 < 4:
        await asyncio.sleep(0.1)
        seen.append(state.activity_code)
        if state.activity_code in (3, 35) or state.water_ml > start_water + 0.5:
            poured = True
            break
    if poured:
        await send_frame(frame_brewer_stop())
        await asyncio.sleep(0.4)
        await send_frame(frame_quit_brewer())
        await asyncio.sleep(0.8)
    return web.json_response({"ok": True, "ml": ml, "poured": poured, "start_code": start_code,
                              "codes_seen": sorted(set(seen)), "water_after": round(state.water_ml, 1),
                              "end_code": state.activity_code})


async def handle_voice_matter_get(request):
    if request.remote not in ("127.0.0.1", "::1"):
        return web.json_response({"error": "local only"}, status=403)
    m = _matter_identity()
    return web.json_response({"passcode": m["passcode"], "discriminator": m["discriminator"], "serial": m["serial"],
                              "open_pairing": _matter.get("open_req", 0),
                              "devices": [{"id": e["id"], "name": e["name"], "on": _hue_is_on(e)} for e in voice_offered()]})


async def handle_voice_matter_post(request):
    if request.remote not in ("127.0.0.1", "::1"):
        return web.json_response({"error": "local only"}, status=403)
    b = await request.json()
    if "pairing" in b:
        was = bool(_matter["pairing"].get("commissioned"))
        _matter["pairing"] = dict(b["pairing"] or {})
        if _matter["pairing"].get("commissioned") and not was:
            _hue_seen["read"] = int(time.time())
            await broadcast({"type": "voice"})
        return web.json_response({"ok": True})
    e = {x["id"]: x for x in voice_offered()}.get(str(b.get("device", "")))
    if not e:
        return web.json_response({"ok": False, "error": "device_off"})
    on = bool(b.get("on"))
    action = (HUE_ON if on else HUE_OFF).get(e["key"])
    _hue_seen.update(command=int(time.time()), command_name=e["name"], command_on=on)
    if not action:
        return web.json_response({"ok": True})

    class _Req:
        query = {"recipe": e["recipe"]} if e["recipe"] else {}
    resp = await _voice_entry(_Req(), action, "alexa")
    return resp


async def alexa_skill_request(ws, req: dict) -> None:
    """A request from the Nuqta Alexa skill, passed on by the hub."""
    rid, op = req.get("id"), req.get("op")
    reply = {"id": rid}
    offered = {e["id"]: e for e in voice_offered()}
    if op == "devices":
        reply["devices"] = [{"id": e["id"], "name": e["name"]} for e in offered.values()]
    elif op in ("set", "state"):
        e = offered.get(str(req.get("device", "")))
        if e is None:
            reply.update(ok=False, error="device_off")
        elif op == "state":
            reply.update(ok=True, on=_hue_is_on(e))
        else:
            on = bool(req.get("on"))
            action = (HUE_ON if on else HUE_OFF).get(e["key"])
            if not action:
                reply.update(ok=True, on=False)          # "off" on a one-shot device: nothing to do
            else:
                _hue_seen.update(command=int(time.time()), command_name=e["name"], command_on=on)

                class _Req:
                    query = {"recipe": e["recipe"]} if e["recipe"] else {}
                task = asyncio.create_task(_voice_entry(_Req(), action, "alexa"))
                try:
                    resp = await asyncio.wait_for(asyncio.shield(task), 4.5)
                    data = json.loads(resp.text or "{}")
                    reply.update(ok=bool(data.get("ok")), error=_voice_reason(data.get("error", "")),
                                 on=on and e["key"] not in ("scale", "wake"))
                except asyncio.TimeoutError:
                    reply.update(ok=True, on=on)          # still loading the recipe; it carries on
    try:
        await ws.send_str(json.dumps({"__alexa_reply__": reply}))
    except Exception:
        pass


def _hue_is_on(entry) -> bool:
    k = entry["key"]
    if k == "coffee":
        return state.brew_active and (entry["recipe"] is None or state.recipe_name == entry["recipe"])
    if k == "pause":
        return state.brew_active and state.activity == "Paused"
    if k == "water":
        return alexa_flags["water"] and module_mode == "brewer"
    if k == "grind":
        return alexa_flags["grind"] and module_mode == "grinder"
    return False




async def start_name_redirect(app):
    """Port 80 answers http://<this Mac's IP> (no port to type) by sending the browser to the dashboard."""
    port = app["dashboard_port"]
    if port == 80:
        return

    async def redirect(request):
        host = (request.host or get_local_ip()).split(":")[0]
        raise web.HTTPFound(f"http://{host}:{port}{request.path_qs}")

    r_app = web.Application()
    r_app.router.add_route("*", "/{tail:.*}", redirect)
    runner = web.AppRunner(r_app, access_log=None)
    await runner.setup()
    try:
        await web.TCPSite(runner, "0.0.0.0", 80, reuse_address=True).start()
        app["name_redirect"] = runner
        log.info("Port 80 redirects to the dashboard (http://%s)", get_local_ip())
    except OSError as e:
        await runner.cleanup()
        log.warning("Port 80 redirect not available (%s) — use http://%s:%d", e, get_local_ip(), port)


def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


_instance_lock = None


def ensure_single_instance():
    """Exit if another Nuqta server is already running on this Mac.
    The lock is released automatically when the process ends (or execs on /api/restart)."""
    global _instance_lock
    lock_path = Path(__file__).resolve().parent / ".nuqta-server.lock"
    _instance_lock = open(lock_path, "a+")
    try:
        if sys.platform == "win32":
            import msvcrt   # Windows has no fcntl; lock the first byte instead
            _instance_lock.seek(0)
            msvcrt.locking(_instance_lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(_instance_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        _instance_lock.seek(0)
        other = _instance_lock.read().strip() or "?"
        print(f"Nuqta server is already running (PID {other}). Stop it first, or use start-nuqta.command to replace it.")
        sys.exit(1)
    _instance_lock.seek(0)
    _instance_lock.truncate()
    _instance_lock.write(str(os.getpid()))
    _instance_lock.flush()


@web.middleware
async def same_origin_only(request, handler):
    """Only the dashboard itself may change things or open the live socket.
    A browser sends an Origin header on those requests; if it names another
    site (a web page trying to reach this server behind the user's back),
    refuse. Requests without Origin (curl, Alexa, scripts) are unaffected."""
    origin = request.headers.get("Origin")
    if origin and (request.method not in ("GET", "HEAD", "OPTIONS") or request.path == "/ws"):
        host = urllib.parse.urlsplit(origin).netloc
        allowed = {request.host}
        pub = os.environ.get("NUQTA_PUBLIC_URL", "")
        if pub:
            allowed.add(urllib.parse.urlsplit(pub).netloc)
        if host not in allowed:
            return web.json_response({"error": "cross_origin"}, status=403)
    return await handler(request)


def main():
    ensure_single_instance()
    port = int(os.environ.get("PORT", 8420))
    app = web.Application(middlewares=[same_origin_only])
    app.on_startup.append(on_startup)
    app["dashboard_port"] = port
    global _dashboard_port
    _dashboard_port = port
    app.on_startup.append(start_name_redirect)
    app.on_cleanup.append(on_cleanup)
    app.router.add_get("/", handle_index)
    app.router.add_get("/analytics", handle_index)
    app.router.add_get("/fonts/{name}", handle_font)
    app.router.add_get("/manifest.webmanifest", handle_manifest)
    app.router.add_get("/nuqta-icon-{size}.png", handle_app_icon)
    app.router.add_get("/ws", handle_ws)
    app.router.add_get("/api/state", handle_state)
    # Cloud
    app.router.add_post("/api/cloud/login", handle_cloud_login)
    app.router.add_post("/api/cloud/sync", handle_cloud_sync)
    app.router.add_post("/api/cloud/logout", handle_cloud_logout)
    app.router.add_get("/api/cloud/status", handle_cloud_status)
    # Schedules
    app.router.add_get("/api/schedules", handle_schedules_get)
    app.router.add_get("/api/recipe-tags", handle_recipe_tags_get)
    app.router.add_post("/api/recipe-tags", handle_recipe_tags_post)
    app.router.add_post("/api/schedules", handle_schedules_post)
    app.router.add_post("/api/demo/brew", handle_demo_brew)
    app.router.add_get("/api/weather", handle_weather)
    app.router.add_put("/api/schedules/{id}", handle_schedules_put)
    app.router.add_delete("/api/schedules/{id}", handle_schedules_delete)
    # Alexa
    app.router.add_post("/api/alexa/{action}", handle_alexa_action)
    app.router.add_get("/api/alexa-state", handle_alexa_state)
    app.router.add_get("/api/voice", handle_voice_get)
    app.router.add_post("/api/voice", handle_voice_post)
    app.router.add_post("/api/voice/confirm", handle_voice_confirm)
    app.router.add_get("/api/voice/matter", handle_voice_matter_get)
    app.router.add_post("/api/voice/matter", handle_voice_matter_post)
    app.router.add_get("/voice/{action}", handle_voice_shortcut)
    app.router.add_post("/voice/{action}", handle_voice_shortcut)
    app.router.add_get("/api/brews", handle_brews_get)
    app.router.add_get("/api/brews/curves", handle_brew_curves)
    app.router.add_post("/api/trace", handle_trace)
    app.router.add_post("/api/machine/reset-modes", handle_reset_modes)
    app.router.add_post("/api/machine/test-volume", handle_test_set_volume)
    app.router.add_get("/api/capabilities", handle_capabilities)
    app.router.add_get("/api/hub/status", handle_hub_status)
    app.router.add_post("/api/hub/request-code", handle_hub_request_code)
    app.router.add_post("/api/hub/verify", handle_hub_verify)
    app.router.add_post("/api/hub/signout", handle_hub_signout)
    app.router.add_get("/sw.js", handle_service_worker)
    app.router.add_get("/api/push/key", handle_push_key)
    app.router.add_post("/api/push/subscribe", handle_push_subscribe)
    app.router.add_post("/api/push/unsubscribe", handle_push_unsubscribe)
    app.router.add_post("/api/push/test", handle_push_test)
    app.router.add_get("/api/analytics", handle_analytics)
    app.router.add_post("/api/brews/{id}/rating", handle_brew_rate)
    app.router.add_get("/api/bags", handle_bags_get)
    app.router.add_post("/api/bags", handle_bags_post)
    app.router.add_patch("/api/bags/{id}", handle_bag_patch)
    # Server control
    app.router.add_post("/api/restart", handle_restart)

    ip = get_local_ip()
    print(f"\n{'='*56}")
    print(f"  xBloom Dashboard")
    print(f"  Local:   http://localhost:{port}")
    print(f"  Network: http://{ip}:{port}")
    public_url = os.environ.get("NUQTA_PUBLIC_URL", "")
    if public_url:
        print(f"  Online:  {public_url}")
    print(f"  Open the Network URL on your iPad/iPhone")
    print(f"  Alexa:   say 'Alexa, turn on xbloom' to brew")
    print(f"{'='*56}\n")

    start_fauxmo(port)
    web.run_app(app, host="0.0.0.0", port=port, print=None)


if __name__ == "__main__":
    main()
