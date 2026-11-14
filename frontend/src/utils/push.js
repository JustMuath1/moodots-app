// Web Push: subscribe this device so "coffee ready" reaches it even when Nuqta is closed.
// Needs a secure page (https). On iPhone/iPad the site must be added to the
// Home Screen and opened from that icon first (Apple only allows push for installed web apps).

import { REMOTE, getToken } from './remote';

// Away from home (the /app page) the phone subscribes with the Nuqta server instead of the home computer.
const SW = REMOTE ? ['/app/sw.js', '/app'] : ['/sw.js', '/'];
const api = (path, body) => fetch(REMOTE ? `/push/${path}` : `/api/push/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(REMOTE ? { Authorization: `Bearer ${getToken()}` } : {}) },
  body: JSON.stringify(body || {}),
});

const urlB64ToUint8 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...b].map((c) => c.charCodeAt(0)));
};

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;
}

// iPhone/iPad Safari: push only works once the site is installed to the Home Screen.
export function needsInstall() {
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return iOS && !standalone;
}

async function reg() {
  return navigator.serviceWorker.register(SW[0], { scope: SW[1] }).then((r) => {
    if (r.active) return r;
    const w = r.installing || r.waiting;
    return new Promise((ok) => { if (!w) return ok(r); w.addEventListener('statechange', () => { if (w.state === 'activated') ok(r); }); });
  });
}

export async function pushState() {
  if (!pushSupported()) return { supported: false, on: false, needsInstall: needsInstall() };
  try {
    const r = await reg();
    const sub = await r.pushManager.getSubscription();
    return { supported: true, on: Boolean(sub), needsInstall: needsInstall(), perm: Notification.permission };
  } catch {
    return { supported: true, on: false, needsInstall: needsInstall() };
  }
}

// Turn push on for this device (must be called from a tap). Returns { ok, reason? }.
export async function pushSubscribe() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  const meta = await fetch(REMOTE ? '/push/vapid-public-key' : '/api/push/key').then((r) => r.json()).catch(() => null);
  const key = meta?.key || meta?.public_key;
  if (!meta?.enabled || !key) return { ok: false, reason: 'server-off' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  const r = await reg();
  let sub = await r.pushManager.getSubscription();
  if (!sub) {
    sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key) });
  }
  const res = await api('subscribe', sub.toJSON()).catch(() => null);
  if (!res || !res.ok) { await sub.unsubscribe().catch(() => {}); return { ok: false, reason: res?.status === 402 ? 'pro' : 'server-off' }; }
  return { ok: true };
}

export async function pushUnsubscribe() {
  try {
    const r = await reg();
    const sub = await r.pushManager.getSubscription();
    if (sub) {
      await api('unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
  return { ok: true };
}

export async function pushTest() {
  return api('test').then((r) => r.json()).catch(() => ({ ok: false }));
}
