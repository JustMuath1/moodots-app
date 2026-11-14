import React, { useEffect, useState } from 'react';
import { pushState, pushSubscribe, pushUnsubscribe, pushTest } from '../utils/push';

// Turn phone/tablet notifications on for this device (Web Push). On iPhone/iPad, the site must be
// added to the Home Screen first — the sheet explains that when needed.
const TX = {
  ar: {
    title: 'التنبيهات', notifHead: 'إشعارات الجهاز', soundHead: 'صوت التنبيه', soundSub: 'رنّة عند جاهزية القهوة على هذا الجهاز', body: 'استلم إشعار «قهوتك جاهزة» على هذا الجهاز حتى لو كان نقطة مغلقاً.',
    on: 'تفعيل الإشعارات', off: 'إيقاف الإشعارات', test: 'إرسال إشعار تجريبي', close: 'إغلاق', sent: 'أُرسل ✓', enabled: 'الإشعارات مفعّلة على هذا الجهاز',
    install: 'على الآيفون/الآيباد: افتح الرابط في سفاري ← زر المشاركة ← «أضف إلى الشاشة الرئيسية»، ثم افتح نقطة من الأيقونة وفعّل الإشعارات من هنا.',
    unsupported: 'هذا المتصفح لا يدعم الإشعارات، أو الصفحة ليست آمنة. افتحه عبر https.',
    proOnly: 'إشعارات الجهاز ضمن نقطة برو.', getPro: 'احصل على برو',
    serverOff: 'الإشعارات غير مهيأة على الخادم بعد.', denied: 'رُفض الإذن. فعّله من إعدادات المتصفح ثم أعد المحاولة.',
  },
  en: {
    title: 'Alerts', notifHead: 'Device notifications', soundHead: 'Alert sound', soundSub: 'A chime when the coffee is ready, on this device', body: 'Get a "coffee ready" alert on this device even when Nuqta is closed.',
    on: 'Turn on notifications', off: 'Turn off', test: 'Send a test', close: 'Close', sent: 'Sent ✓', enabled: 'Notifications are on for this device',
    install: 'On iPhone/iPad: open the link in Safari → Share → Add to Home Screen, then open Nuqta from that icon and turn notifications on here.',
    unsupported: 'This browser can’t do notifications, or the page isn’t secure. Open the site over https.',
    proOnly: 'Device notifications are part of Nuqta Pro.', getPro: 'Get Pro',
    serverOff: 'Notifications aren’t set up on the server yet.', denied: 'Permission was blocked. Allow it in the browser settings and try again.',
  },
};

export default function NotifySheet({ lang, onClose, soundOn, onToggleSound, pushAvailable = true, pro = true, onGetPro }) {
  const T = TX[lang] || TX.en;
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = () => pushState().then(setSt);
  useEffect(() => { refresh(); }, []);

  const toggle = async () => {
    setBusy(true); setMsg('');
    if (st?.on) { await pushUnsubscribe(); }
    else {
      const r = await pushSubscribe();
      if (!r.ok) setMsg(T[r.reason === 'server-off' ? 'serverOff' : r.reason === 'denied' ? 'denied' : 'unsupported'] || '');
    }
    await refresh(); setBusy(false);
  };
  const test = async () => { setBusy(true); const r = await pushTest(); setMsg(r.ok ? T.sent : ''); setBusy(false); };

  const blocked = st && (!st.supported || st.needsInstall);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-form" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T.title}>
        <div className="modal-title">{T.title}</div>

        <div className="alert-row">
          <div className="alert-text"><b>{T.soundHead}</b><span>{T.soundSub}</span></div>
          <button className={`switch${soundOn ? ' on' : ''}`} role="switch" aria-checked={soundOn} aria-label={T.soundHead} onClick={onToggleSound} />
        </div>

        {pushAvailable && <>
        <div className="alert-sep" />
        <div className="alert-text head"><b>{T.notifHead} <span className="pro-badge sm">PRO</span></b></div>
        <span className="sheet-note">{T.body}</span>
        {!pro && <div className="notify-hint">{T.proOnly}</div>}
        {pro && <>
        {st?.needsInstall && <div className="notify-hint">{T.install}</div>}
        {st && !st.supported && !st.needsInstall && <div className="notify-hint">{T.unsupported}</div>}
        {st?.on && <div className="notify-on">● {T.enabled}</div>}
        {msg && <div className="notify-hint">{msg}</div>}
        </>}
        </>}
        <div className="btn-row">
          <button className="nb nb-secondary" onClick={onClose}>{T.close}</button>
          {pushAvailable && pro && st?.on && <button className="nb nb-secondary" onClick={test} disabled={busy}>{T.test}</button>}
          {pushAvailable && !pro && <button className="nb nb-primary" onClick={onGetPro}>{T.getPro}</button>}
          {pushAvailable && pro && !blocked && <button className={`nb ${st?.on ? 'nb-secondary' : 'nb-primary'}`} onClick={toggle} disabled={busy || !st}>{st?.on ? T.off : T.on}</button>}
        </div>
      </div>
    </div>
  );
}
