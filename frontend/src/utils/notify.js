// "Coffee ready" alerts on whatever device shows the dashboard.
// System notifications need a secure page (https or localhost); on a plain http LAN address
// browsers don't offer them, so the page falls back to vibration and a flashing tab title.

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;

// Must run inside a tap (browsers only ask for permission from a user gesture)
export function requestNotifyPermission() {
  try {
    if (canNotify() && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  } catch { /* old Safari: callback form only, ignore */ }
}

let titleTimer = null;
let savedTitle = '';
function flashTitle(text) {
  if (titleTimer) return;
  savedTitle = document.title;
  let on = false;
  titleTimer = setInterval(() => { on = !on; document.title = on ? text : savedTitle; }, 1000);
  const stop = () => {
    if (document.hidden) return;
    clearInterval(titleTimer);
    titleTimer = null;
    document.title = savedTitle;
    document.removeEventListener('visibilitychange', stop);
    window.removeEventListener('focus', stop);
  };
  document.addEventListener('visibilitychange', stop);
  window.addEventListener('focus', stop);
}

export async function notifyReady(title, body) {
  try { navigator.vibrate?.([220, 120, 220, 120, 400]); } catch {}
  if (document.hidden) flashTitle(`☕ ${title}`);
  if (!canNotify() || Notification.permission !== 'granted') return;
  const opts = { body, icon: '/moodots-icon-192.png', badge: '/moodots-icon-192.png', tag: 'nuqta-ready', renotify: true };
  try {
    new Notification(title, opts);
  } catch {
    // Android Chrome only allows notifications through a service worker
    try { (await navigator.serviceWorker?.getRegistration())?.showNotification(title, opts); } catch {}
  }
}
