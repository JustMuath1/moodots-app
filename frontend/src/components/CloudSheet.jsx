import React, { useEffect, useState } from 'react';

// Nuqta Cloud sign-in: links this home to the owner's account on the hub, so a
// phone can reach it from anywhere and brew-done alerts go through the hub.
// Email -> 6-digit code -> connected. The server does the talking to the hub
// (/api/hub/*); this sheet only drives it.
const HUB_URL = 'https://hub.nuqtasa.tools';

const TX = {
  ar: {
    title: 'Nuqta Cloud', intro: 'اربط هذا الجهاز بحسابك لتصل إلى نقطة من أي مكان وتصلك تنبيهات القهوة على جوالك.',
    email: 'البريد الإلكتروني', send: 'أرسل الرمز', sending: 'جارٍ الإرسال…',
    codeSent: 'أرسلنا رمزاً من ٦ أرقام إلى', code: 'الرمز', verify: 'تأكيد', verifying: 'جارٍ التأكيد…',
    back: 'تغيير البريد', close: 'إغلاق', signout: 'تسجيل الخروج',
    account: 'الحساب', status: 'الاشتراك', link: 'الاتصال',
    active: 'فعّال', inactive: 'غير مشترك', connected: 'متصل', connecting: 'جارٍ الاتصال…', offline: 'غير متصل',
    monthly: 'شهري', yearly: 'سنوي', until: 'حتى',
    notSubscribed: 'تم ربط الجهاز، لكن لا يوجد اشتراك فعّال على هذا البريد بعد.',
    errors: {
      invalid_email: 'البريد غير صحيح.', rate_limited: 'انتظر قليلاً ثم أعد المحاولة.',
      invalid_code: 'الرمز غير صحيح أو انتهت صلاحيته.', unreachable: 'تعذّر الوصول إلى Nuqta Cloud. تحقق من الإنترنت.',
      send_failed: 'تعذّر إرسال البريد. حاول لاحقاً.', default: 'حدث خطأ. حاول مرة أخرى.',
    },
  },
  en: {
    title: 'Nuqta Cloud', intro: 'Link this device to your account to reach Nuqta from anywhere and get coffee alerts on your phone.',
    email: 'Email', send: 'Send code', sending: 'Sending…',
    codeSent: 'We sent a 6-digit code to', code: 'Code', verify: 'Verify', verifying: 'Verifying…',
    back: 'Change email', close: 'Close', signout: 'Sign out',
    account: 'Account', status: 'Subscription', link: 'Connection',
    active: 'Active', inactive: 'Not subscribed', connected: 'Connected', connecting: 'Connecting…', offline: 'Offline',
    monthly: 'Monthly', yearly: 'Yearly', until: 'until',
    notSubscribed: 'This device is linked, but there’s no active subscription on this email yet.',
    errors: {
      invalid_email: 'That email doesn’t look right.', rate_limited: 'Wait a moment, then try again.',
      invalid_code: 'Wrong or expired code.', unreachable: 'Can’t reach Nuqta Cloud. Check the internet.',
      send_failed: 'Couldn’t send the email. Try again later.', default: 'Something went wrong. Try again.',
    },
  },
};

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({ ok: false }));
}

export default function CloudSheet({ lang, onClose }) {
  const T = TX[lang] || TX.en;
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => fetch('/api/hub/status').then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false }));
  useEffect(() => { refresh(); }, []);
  // After sign-in the server dials out to the hub in the background; poll until it's connected.
  useEffect(() => {
    if (!status?.configured || status.connected || !status.active) return undefined;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [status]);

  const fail = (res) => setError(T.errors[res?.error] || T.errors.default);

  const sendCode = async () => {
    setError(''); setBusy(true);
    const res = await post('/api/hub/request-code', { hub_url: HUB_URL, email: email.trim() });
    setBusy(false);
    if (res.ok) { setStep('code'); setCode(''); } else fail(res);
  };

  const verify = async () => {
    setError(''); setBusy(true);
    const res = await post('/api/hub/verify', { hub_url: HUB_URL, email: email.trim(), code: code.trim() });
    setBusy(false);
    if (res.ok) refresh(); else fail(res);
  };

  const signOut = async () => { await post('/api/hub/signout'); setStep('email'); setCode(''); refresh(); };

  const fmtDate = (ts) => new Date(ts * 1000).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  let body;
  if (!status) {
    body = null;
  } else if (status.configured) {
    const link = status.connected ? T.connected : status.active ? T.connecting : T.offline;
    body = (
      <>
        <div className="alert-row"><div className="alert-text"><b>{T.account}</b><span>{status.email}</span></div></div>
        <div className="alert-sep" />
        <div className="alert-row">
          <div className="alert-text"><b>{T.status}</b>
            <span>{status.active
              ? `${T.active}${status.plan ? ` · ${T[status.plan] || status.plan}` : ''}${status.expires ? ` · ${T.until} ${fmtDate(status.expires)}` : ''}`
              : T.inactive}</span>
          </div>
        </div>
        <div className="alert-sep" />
        <div className="alert-row"><div className="alert-text"><b>{T.link}</b><span>{link}</span></div></div>
        {!status.active && <div className="cloud-note">{T.notSubscribed}</div>}
        <div className="btn-row">
          <button className="nb nb-secondary" onClick={signOut}>{T.signout}</button>
          <button className="nb nb-primary" onClick={onClose}>{T.close}</button>
        </div>
      </>
    );
  } else if (step === 'email') {
    body = (
      <>
        <div className="cloud-note">{T.intro}</div>
        <input type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder={T.email}
          value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && sendCode()} />
        {error && <div className="cloud-err">{error}</div>}
        <div className="btn-row">
          <button className="nb nb-secondary" onClick={onClose}>{T.close}</button>
          <button className="nb nb-primary" onClick={sendCode} disabled={!email.includes('@') || busy}>{busy ? T.sending : T.send}</button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="cloud-note">{T.codeSent} <b dir="ltr">{email}</b></div>
        <input className="cloud-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} placeholder="000000"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verify()} />
        {error && <div className="cloud-err">{error}</div>}
        <div className="btn-row">
          <button className="nb nb-secondary" onClick={() => { setStep('email'); setError(''); }}>{T.back}</button>
          <button className="nb nb-primary" onClick={verify} disabled={code.length !== 6 || busy}>{busy ? T.verifying : T.verify}</button>
        </div>
      </>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-form" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T.title}>
        <div className="modal-title">{T.title}</div>
        {body}
      </div>
    </div>
  );
}
