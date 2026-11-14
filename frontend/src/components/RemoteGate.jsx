import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogoMark } from './Logo';
import { THEMES, applyTheme, loadTheme } from '../utils/themes';
import {
  getToken, getEmail, requestCode, verifyCode, remoteStatus, signOut,
  onLink, linkState, resetLink, onGate, initialLang, saveLang,
} from '../utils/remote';

// Sign-in and connection screens for the remote dashboard (design: nuqta-cloud-handoff).
// Always Copper; the customer's own theme is applied once the dashboard opens.
const PRO_URL = '/';
const TX = {
  ar: {
    tag: 'افتح نقطتك من أي مكان', sub1: 'سجّل الدخول ببريدك لتتحكّم في آلتك وأنت بعيد.',
    email_label: 'البريد الإلكتروني', send: 'إرسال الرمز', sending: 'جارٍ الإرسال…',
    no_pro: 'ليس لديك Pro؟', get_pro_link: 'احصل على نقطة Pro',
    err_invalid: 'البريد غير صحيح. تحقّق منه وحاول مرة أخرى.', err_wait: 'انتظر قليلاً قبل طلب رمز جديد.',
    err_send: 'تعذّر إرسال الرمز. حاول بعد قليل.', err_net: 'لا يوجد اتصال بالإنترنت. حاول مرة أخرى.',
    wait_btn: 'حاول بعد', code_title: 'أدخل الرمز', code_sub: 'أرسلنا رمزاً من 6 أرقام إلى',
    verify: 'تحقّق', verifying: 'جارٍ التحقق…', change: 'تغيير البريد', clear: 'مسح',
    err_wrong: 'الرمز غير صحيح. تحقّق منه وحاول مرة أخرى.', err_exp: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.',
    resend: 'إرسال رمز جديد', resend_in: 'رمز جديد بعد',
    conn_title: 'يتّصل بمنزلك…', conn_sub: 'نصل إلى الكمبيوتر الذي يشغّل نقطة',
    off_title: 'منزلك غير متصل', off_sub: 'الكمبيوتر الذي يشغّل نقطة مطفأ أو في وضع السكون أو بلا إنترنت.',
    retry: 'حاول مرة أخرى', off_hint: 'تأكّد أن الكمبيوتر الذي يشغّل نقطة يعمل.',
    last_seen: 'آخر اتصال', never: 'لم يتصل منزلك بعد. سجّل الدخول من تطبيق نقطة في المنزل: الإعدادات ← نقطة برو.',
    signout: 'تسجيل الخروج', np_title: 'هذا الحساب بلا Pro',
    np_sub: 'الدخول من الخارج ميزة في نقطة Pro. دفعة واحدة تفتحها لك مدى الحياة.',
    get_pro: 'احصل على نقطة Pro', price: (n) => `${n} ر.س · مرة واحدة`, other: 'الدخول ببريد آخر', lang: 'English',
  },
  en: {
    tag: 'Open your Nuqta from anywhere', sub1: 'Sign in with your email to control your machine while you are away.',
    email_label: 'Email', send: 'Send code', sending: 'Sending…',
    no_pro: "Don't have Pro?", get_pro_link: 'Get Nuqta Pro',
    err_invalid: "That email doesn't look right. Check it and try again.", err_wait: 'Wait a moment before asking for another code.',
    err_send: "Couldn't send the code. Try again shortly.", err_net: 'No internet connection. Try again.',
    wait_btn: 'Try again in', code_title: 'Enter the code', code_sub: 'We sent a 6-digit code to',
    verify: 'Verify', verifying: 'Verifying…', change: 'Change email', clear: 'Clear',
    err_wrong: "That code isn't right. Check it and try again.", err_exp: 'This code has expired. Ask for a new one.',
    resend: 'Send a new code', resend_in: 'New code in',
    conn_title: 'Reaching your home…', conn_sub: 'Connecting to the computer running Nuqta',
    off_title: 'Your home is offline', off_sub: 'The computer running Nuqta is off, asleep, or has no internet.',
    retry: 'Try again', off_hint: 'Make sure the computer running Nuqta is on.',
    last_seen: 'Last seen', never: "Your home hasn't connected yet. Sign in from the Nuqta app at home: Settings → Nuqta Pro.",
    signout: 'Sign out', np_title: 'No Pro on this account',
    np_sub: 'Remote access is part of Nuqta Pro. One payment unlocks it for good.',
    get_pro: 'Get Nuqta Pro', price: (n) => `${n} SAR · one-time`, other: 'Use another email', lang: 'العربية',
  },
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function ago(ts, lang) {
  const mins = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
  const [n, unit] = mins < 60 ? [mins, 'minute'] : mins < 1440 ? [Math.round(mins / 60), 'hour'] : [Math.round(mins / 1440), 'day'];
  try { return new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'always' }).format(-n, unit); } catch { return `${n} ${unit}`; }
}

// ---- dot art ---------------------------------------------------------------
function Dots({ rows, step = 6, r = 2.4, colors, className }) {
  const w = Math.max(...rows.map((x) => x.length)) * step;
  const out = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.' && colors[ch]) out.push(<circle key={`${x}-${y}`} cx={x * step + step / 2} cy={y * step + step / 2} r={r} fill={colors[ch]} />);
  }));
  return <svg className={className} width={w} height={rows.length * step} viewBox={`0 0 ${w} ${rows.length * step}`} aria-hidden="true">{out}</svg>;
}
const HOUSE = ['.....a.....', '....aaa....', '...aaaaa...', '..aaaaaaa..', '.aaaaaaaaa.', 'aaaaaaaaaaa', 'aaaaaaaaaaa', 'aaaadddaaaa', 'aaaadddaaaa', 'aaaadddaaaa'];
const PHONE = ['aaaaa', 'a...a', 'a...a', 'a...a', 'a...a', 'a...a', 'a...a', 'aaaaa'];
const LOCK = ['...aaaaa...', '..a.....a..', '..a.....a..', '..a.....a..', 'aaaaaaaaaaa', 'aaaaaaaaaaa', 'aaaaadaaaaa', 'aaaaadaaaaa', 'aaaaaaaaaaa', 'aaaaaaaaaaa'];
const ZED = ['aaa', '.a.', 'aaa'];
const C = { accent: '#E3925A', text: '#F3EDE4', dim: '#3A332D', warn: '#E8B84F', bg: '#12100E' };

function TravelLine({ rtl }) {
  const [f, setF] = useState(0);
  useEffect(() => { const iv = setInterval(() => setF((x) => (x + 1) % 18), 110); return () => clearInterval(iv); }, []);
  const n = 14;
  return (
    <svg width={n * 12} height="12" viewBox={`0 0 ${n * 12} 12`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const pos = rtl ? n - 1 - i : i;            // lit dots travel from the phone side
        const lit = pos <= f && pos > f - 6;
        return <circle key={i} cx={i * 12 + 6} cy="6" r="3.6" fill={lit ? C.accent : C.dim} />;
      })}
    </svg>
  );
}

const ErrLine = ({ children }) => <div className="rg-err"><i />{children}</div>;

export default function RemoteGate({ children }) {
  const [lang, setLang] = useState(initialLang);
  const T = TX[lang];
  const rtl = lang === 'ar';
  const [phase, setPhase] = useState(getToken() ? 'connecting' : 'email');
  const [email, setEmail] = useState(getEmail());
  const [code, setCode] = useState('');
  const [wrongCode, setWrongCode] = useState('');   // the rejected digits, shown in red until the next keystroke
  const [err, setErr] = useState('');          // invalid | wait | send | net | wrong | exp
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);         // seconds until another code can be requested
  const [info, setInfo] = useState({});        // last status from the server
  const codeRef = useRef(null);
  const errRef = useRef('');
  errRef.current = err;

  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  // Copper while the gate is showing; the saved theme once the dashboard opens
  useEffect(() => {
    if (phase === 'ready') { applyTheme(loadTheme()); return; }
    const root = document.documentElement;
    Object.entries(THEMES.copper.vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
    root.style.colorScheme = 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', C.bg);
  }, [phase]);
  useEffect(() => {
    if (phase === 'ready') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl, phase]);

  const check = useCallback(async (showConnecting = true) => {
    if (showConnecting) setPhase('connecting');
    const started = Date.now();
    const st = await remoteStatus();
    const hold = showConnecting ? Math.max(0, 1200 - (Date.now() - started)) : 0;
    await new Promise((r) => setTimeout(r, hold));
    if (st.status === 401) { await signOut(); setPhase('email'); return; }
    if (!st.ok) { setInfo((i) => ({ ...i, net: true })); setPhase('offline'); return; }
    setInfo(st);
    if (st.email) setEmail(st.email);
    if (!st.active) setPhase('nopro');
    else if (!st.home_online) setPhase('offline');
    else { resetLink(); setPhase('ready'); }
  }, []);

  useEffect(() => { if (getToken()) check(); }, [check]);

  // While the dashboard is open: if the live link stays down, find out why.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    let timer = setTimeout(() => { if (linkState().link !== 'up') check(false); }, 9000);
    const off = onLink(({ link }) => {
      clearTimeout(timer);
      if (link === 'down') timer = setTimeout(() => check(false), 9000);
    });
    return () => { clearTimeout(timer); off(); };
  }, [phase, check]);
  // On the offline screen: look again by itself every 10 s.
  useEffect(() => {
    if (phase !== 'offline') return undefined;
    const iv = setInterval(() => check(false), 10000);
    return () => clearInterval(iv);
  }, [phase, check]);

  const doSignOut = useCallback(async () => { await signOut(); setCode(''); setErr(''); setEmail(''); setPhase('email'); }, []);
  useEffect(() => onGate((what) => { if (what === 'signout') doSignOut(); else if (what === 'recheck') check(false); }), [doSignOut, check]);

  const toggleLang = () => { const l = rtl ? 'en' : 'ar'; saveLang(l); setLang(l); };

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setErr('invalid'); return false; }
    setBusy(true); setErr('');
    const res = await requestCode(e);
    setBusy(false);
    if (res.ok) { setEmail(e); setCode(''); setWait(30); setPhase('code'); setTimeout(() => codeRef.current?.focus(), 50); return true; }
    if (res.status === 429) { setErr('wait'); setWait(res.retry_after || 30); }
    else if (res.error === 'invalid_email') setErr('invalid');
    else setErr(res.status === 0 ? 'net' : 'send');
    return false;
  };

  const verify = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true); setErr('');
    const res = await verifyCode(email, value);
    setBusy(false);
    if (res.ok) { setCode(''); check(); return; }
    if (res.error === 'expired_code') setErr('exp');
    else if (res.status === 0) setErr('net');
    else { setErr('wrong'); setWrongCode(value); setCode(''); }
  };

  const onCode = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (err) setErr('');
    setWrongCode('');
    setCode(v);
    if (v.length === 6) verify(v);
  };

  // The real input is invisible on top of the cells, so keep its caret at the end:
  // otherwise a tap lands the caret mid-number and Backspace seems to do nothing.
  const caretToEnd = (e) => { const el = e.target; const n = el.value.length; try { if (el.selectionStart !== n || el.selectionEnd !== n) el.setSelectionRange(n, n); } catch {} };
  // Deleting is handled here rather than left to the invisible input, so it works the
  // same on every phone keyboard: one digit at a time, or the whole rejected code.
  const deleteOne = useCallback(() => {
    if (errRef.current === 'wrong') { setErr(''); setWrongCode(''); setCode(''); return; }
    if (errRef.current) setErr('');
    setCode((c) => c.slice(0, -1));
  }, []);
  const onCodeKey = (e) => {
    if (e.key === 'Enter') { verify(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); deleteOne(); }
  };
  useEffect(() => {
    const el = codeRef.current;
    if (!el) return undefined;
    const h = (ev) => { if (ev.inputType && ev.inputType.startsWith('delete')) { ev.preventDefault(); deleteOne(); } };
    el.addEventListener('beforeinput', h);
    return () => el.removeEventListener('beforeinput', h);
  }, [phase, deleteOne]);
  const clearCode = () => { setErr((x) => (x === 'wrong' ? '' : x)); setWrongCode(''); setCode(''); codeRef.current?.focus(); };

  if (phase === 'ready') return children;

  let body;
  if (phase === 'email') {
    const waiting = err === 'wait' && wait > 0;
    body = (
      <>
        <LogoMark size={48} className="rg-mark" />
        <h1 className="rg-title">{T.tag}</h1>
        <p className="rg-sub">{T.sub1}</p>
        <label className="rg-label" htmlFor="rg-email">{T.email_label}</label>
        <input id="rg-email" className={`rg-field${err === 'invalid' ? ' bad' : ''}`} type="email" inputMode="email" autoComplete="email" dir="ltr"
          placeholder="name@email.com" value={email} onChange={(e) => { setEmail(e.target.value); if (err === 'invalid') setErr(''); }}
          onKeyDown={(e) => e.key === 'Enter' && !waiting && sendCode()} />
        {err === 'invalid' && <ErrLine>{T.err_invalid}</ErrLine>}
        {err === 'wait' && <ErrLine>{T.err_wait}</ErrLine>}
        {err === 'send' && <ErrLine>{T.err_send}</ErrLine>}
        {err === 'net' && <ErrLine>{T.err_net}</ErrLine>}
        <button className="rg-btn" onClick={sendCode} disabled={waiting || busy}>
          {waiting ? <>{T.wait_btn} <span dir="ltr">{mmss(wait)}</span></> : busy ? T.sending : T.send}
        </button>
        <div className="rg-foot">{T.no_pro} <a href={PRO_URL}>{T.get_pro_link} <span aria-hidden="true">{rtl ? '←' : '→'}</span></a></div>
      </>
    );
  } else if (phase === 'code') {
    const shown = err === 'wrong' ? wrongCode : code;
    const cells = Array.from({ length: 6 }, (_, i) => shown[i] || '');
    body = (
      <>
        <h1 className="rg-title top">{T.code_title}</h1>
        <p className="rg-sub">{T.code_sub} <b dir="ltr">{email}</b></p>
        <div className={`rg-cells${err === 'wrong' ? ' bad' : ''}`} dir="ltr" onClick={() => codeRef.current?.focus()}>
          {cells.map((d, i) => <span key={i} className={`rg-cell${i === code.length && !err ? ' active' : ''}`}>{d}</span>)}
          <input ref={codeRef} className="rg-code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={onCode}
            onKeyDown={onCodeKey} onSelect={caretToEnd} onFocus={caretToEnd} onClick={caretToEnd} aria-label={T.code_title} autoFocus />
        </div>
        {err === 'wrong' && <ErrLine>{T.err_wrong}</ErrLine>}
        {err === 'exp' && <ErrLine>{T.err_exp}</ErrLine>}
        {err === 'net' && <ErrLine>{T.err_net}</ErrLine>}
        {err === 'wait' && <ErrLine>{T.err_wait}</ErrLine>}
        {err === 'send' && <ErrLine>{T.err_send}</ErrLine>}
        <button className="rg-btn" onClick={() => verify()} disabled={(code.length !== 6 && err !== 'wrong') || busy || err === 'exp'}>{busy ? T.verifying : T.verify}</button>
        <div className="rg-row">
          <button className="rg-link" onClick={() => { setPhase('email'); setErr(''); setCode(''); }}>{T.change}</button>
          {(code || err === 'wrong') && <button className="rg-link quiet" onClick={clearCode}>{T.clear}</button>}
          {wait > 0 && err !== 'exp'
            ? <span className="rg-faint">{T.resend_in} <span dir="ltr">{mmss(wait)}</span></span>
            : <button className="rg-link" onClick={sendCode} disabled={busy}>{T.resend}</button>}
        </div>
      </>
    );
  } else if (phase === 'connecting') {
    body = (
      <div className="rg-center">
        <LogoMark size={64} className="rg-mark xb-boot" />
        <div className="rg-linkrow" dir="ltr" style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}>
          <Dots rows={PHONE} step={8} r={3} colors={{ a: C.accent }} />
          <TravelLine rtl={rtl} />
          <Dots rows={HOUSE} colors={{ a: C.accent, d: C.text }} />
        </div>
        <h2 className="rg-h2">{T.conn_title}</h2>
        <p className="rg-sub sm">{T.conn_sub}</p>
      </div>
    );
  } else if (phase === 'offline') {
    body = (
      <>
        <div className="rg-center grow">
          <div className="rg-sleep"><Dots rows={HOUSE} step={8} r={3.2} colors={{ a: C.dim, d: '#4A423B' }} /><Dots className="rg-z" rows={ZED} step={8} r={3} colors={{ a: C.warn }} /></div>
          <h2 className="rg-h2 lg">{T.off_title}</h2>
          <p className="rg-sub">{info.net ? T.err_net : T.off_sub}</p>
          {!info.net && <p className="rg-faint sm">{info.last_seen ? <>{T.last_seen} {ago(info.last_seen, lang)}</> : T.never}</p>}
        </div>
        <div className="rg-hint"><i />{T.off_hint}</div>
        <button className="rg-btn" onClick={() => check()}>{T.retry}</button>
        <button className="rg-quiet" onClick={doSignOut}>{T.signout}</button>
      </>
    );
  } else {
    body = (
      <>
        <div className="rg-center grow">
          <Dots rows={LOCK} step={8} r={3.2} colors={{ a: C.accent, d: C.bg }} />
          <h2 className="rg-h2 lg">{T.np_title}</h2>
          <span className="rg-chip" dir="ltr">{email}</span>
          <p className="rg-sub">{T.np_sub}</p>
        </div>
        <div className="rg-faint sm center">{T.price(info.price_sar || 49)}</div>
        <a className="rg-btn" href={PRO_URL}>{T.get_pro}</a>
        <button className="rg-btn secondary" onClick={doSignOut}>{T.other}</button>
      </>
    );
  }

  return (
    <div className="rg" dir={rtl ? 'rtl' : 'ltr'} lang={lang}>
      <div className="rg-col">
        <button className="rg-lang" onClick={toggleLang}>{T.lang}</button>
        {body}
      </div>
    </div>
  );
}
