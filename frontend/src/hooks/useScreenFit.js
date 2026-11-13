import { useCallback, useEffect, useState } from 'react';

const FS_KEY = 'nuqta_fullscreen';

// Mobile browsers count the area behind the address bar in 100vh; track the real visible height.
export function useAppHeight() {
  useEffect(() => {
    const set = () => document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
    set();
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    return () => {
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);
}

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsSupported = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function requestFs() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  try { return Promise.resolve(req?.call(el, { navigationUI: 'hide' })).catch(() => {}); } catch { return Promise.resolve(); }
}
function exitFs() {
  const ex = document.exitFullscreen || document.webkitExitFullscreen;
  try { return Promise.resolve(ex?.call(document)).catch(() => {}); } catch { return Promise.resolve(); }
}

function isTablet() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return coarse && Math.min(window.screen.width, window.screen.height) >= 600;
}

function loadPref() {
  try {
    const v = localStorage.getItem(FS_KEY);
    if (v === 'auto' || v === 'off') return v;
  } catch {}
  return isTablet() ? 'auto' : 'off';
}

// Fullscreen hides the browser's address/navigation bars. Browsers only allow it from a tap,
// so with pref "auto" the first tap after load (or after leaving fullscreen) re-enters it.
export function useFullscreen() {
  const [supported] = useState(fsSupported);
  const [active, setActive] = useState(() => Boolean(fsElement()));
  const [pref, setPref] = useState(loadPref);

  useEffect(() => {
    const onChange = () => setActive(Boolean(fsElement()));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    if (!supported || pref !== 'auto' || active) return;
    const onTap = () => { if (!fsElement()) requestFs(); };
    window.addEventListener('click', onTap, true);
    return () => window.removeEventListener('click', onTap, true);
  }, [supported, pref, active]);

  const toggle = useCallback(() => {
    const next = fsElement() ? 'off' : 'auto';
    try { localStorage.setItem(FS_KEY, next); } catch {}
    setPref(next);
    if (next === 'off') exitFs(); else requestFs();
  }, []);

  return { supported, active, toggle };
}
