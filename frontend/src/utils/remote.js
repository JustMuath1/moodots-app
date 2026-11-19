// Remote mode: the dashboard opened through the moodots server (away from home)
// instead of from the home computer. The server sets window.__NUQTA_REMOTE__.
// At home none of this runs.
export const REMOTE = typeof window !== 'undefined' && Boolean(window.__NUQTA_REMOTE__);

const TOKEN_KEY = 'nuqta_remote_session';
const EMAIL_KEY = 'nuqta_remote_email';
const LANG_KEY = 'nuqta_lang';
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : null;

const store = {
  get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};

export const getToken = () => store.get(TOKEN_KEY);
export const getEmail = () => store.get(EMAIL_KEY);
export const savedLang = () => store.get(LANG_KEY);
export const saveLang = (l) => store.set(LANG_KEY, l);

// ---- the moodots server (sign-in and status) --------------------------------
async function hub(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${getToken()}`;
  try {
    const r = await nativeFetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, ...data };
  } catch {
    return { status: 0, ok: false, error: 'network' };
  }
}

export const requestCode = (email) => hub('/auth/request-code', { method: 'POST', body: { email } });

export async function verifyCode(email, code) {
  const res = await hub('/auth/verify', { method: 'POST', body: { email, code, label: 'Remote browser' } });
  if (res.ok && res.session_token) {
    store.set(TOKEN_KEY, res.session_token);
    store.set(EMAIL_KEY, email);
  }
  return res;
}

export const remoteStatus = () => hub('/remote/status', { auth: true });

export async function signOut() {
  if (getToken()) await hub('/auth/logout', { method: 'POST', auth: true });
  store.set(TOKEN_KEY, '');
  store.set(EMAIL_KEY, '');
}

export function socketUrl() {
  if (!REMOTE) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/client?token=${encodeURIComponent(getToken())}`;
}

// ---- link state: is the live connection to home up? ------------------------
let link = 'down';             // 'up' | 'down'
let everUp = false;
const listeners = new Set();
export const linkState = () => ({ link, everUp });
export function onLink(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setLink(next) {
  if (next === 'up') everUp = true;
  if (next === link) return;
  link = next;
  listeners.forEach((fn) => fn(linkState()));
}
export function resetLink() { link = 'down'; everUp = false; }

// ---- the dashboard's own /api calls, carried over the live link ------------
let socket = null;
let seq = 0;
const waiting = new Map();

export function attachSocket(ws) { socket = ws; }
export function detachSocket(ws) {
  if (socket === ws) socket = null;
  waiting.forEach(({ resolve }) => resolve(new Response('', { status: 503 })));
  waiting.clear();
}
// returns true when the message was an answer to one of our requests
export function takeReply(msg) {
  if (!msg || msg.type !== '__http__') return false;
  const w = waiting.get(msg.id);
  if (w) {
    waiting.delete(msg.id);
    clearTimeout(w.timer);
    w.resolve(new Response(msg.body || '', { status: msg.status || 502, headers: { 'Content-Type': 'application/json' } }));
  }
  return true;
}

function viaLink(path, init = {}) {
  return new Promise((resolve) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) { resolve(new Response('', { status: 503 })); return; }
    const id = `r${++seq}`;
    const timer = setTimeout(() => { waiting.delete(id); resolve(new Response('', { status: 504 })); }, 25000);
    waiting.set(id, { resolve, timer });
    socket.send(JSON.stringify({ __http__: { id, path, method: (init.method || 'GET').toUpperCase(), body: typeof init.body === 'string' ? init.body : null } }));
  });
}

if (REMOTE) {
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.startsWith('/api/')) return viaLink(url, init);
    return nativeFetch(input, init);
  };
}

// ---- small bridge so the dashboard can ask the sign-in gate to act ---------
const gateListeners = new Set();
export function onGate(fn) { gateListeners.add(fn); return () => gateListeners.delete(fn); }
export function askGate(what) { gateListeners.forEach((fn) => fn(what)); }   // 'signout' | 'recheck'

export const initialLang = () => savedLang() || (REMOTE ? 'ar' : 'en');
