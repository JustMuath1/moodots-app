import React, { useEffect, useState } from 'react';
import Logo from './Logo';
import { THEMES } from '../utils/themes';
import { FREE_THEMES, PRO_PRICE_SAR, HUB_URL } from '../utils/pro';

// "Get moodots Pro": what Pro adds, the one-time price, and how to unlock it.
const TX = {
  ar: {
    title: 'مودوتس برو', price: 'ر.س', once: 'مرة واحدة · مدى الحياة',
    activeTitle: 'مودوتس برو مفعّلة', activeSub: 'كل الميزات مفتوحة على هذا الجهاز. شكراً لدعمك!',
    f1: 'تحليلات التحضير', f1d: 'كم تحضّر وأوقاتك المفضلة، الوصفات الأكثر، ثبات الوزن، التقييمات، الماء، تكلفة الكوب والبن المستهلك.',
    f2: 'كل الثيمات', f2d: 'سعودي، الرياض، الدمام، الباحة، رمضاني ونيون.',
    f3: 'كل مشاهد الانتظار', f3d: 'الدلة، النخلة، الرياض، الدمام والباحة.',
    f6: 'التحكم الصوتي', f6d: 'أسماء صوتية لوصفاتك مع أليكسا، واختصارات Siri و NFC، وخيارات الأمان، وسجل الأوامر.',
    f7: 'إشعارات الجهاز', f7d: 'إشعار «قهوتك جاهزة» على جوالك أو جهازك اللوحي حتى لو كان مودوتس مغلقاً.',
    f4: 'تحديثات تلقائية للميزات', f4d: 'تصلك ميزات برو الجديدة وتحديثاتها تلقائياً.',
    f5: 'moodots Cloud', f5d: 'افتح مودوتس من أي مكان عبر hub.nuqtasa.tools/app، وتنبيه «قهوتك جاهزة» على جوالك.',
    get: 'احصل على برو', have: 'لدي برو · تسجيل الدخول', close: 'إغلاق',
    how: 'بعد الشراء سجّل الدخول هنا بنفس البريد، وتنفتح الميزات فوراً.',
  },
  en: {
    title: 'moodots Pro', price: 'SAR', once: 'once · for life',
    activeTitle: 'moodots Pro is active', activeSub: 'Every feature is unlocked on this device. Thanks for your support!',
    f1: 'Brew analytics', f1d: 'How much and when you brew, top recipes, dose consistency, ratings, water, cost per cup and beans used.',
    f2: 'Every theme', f2d: 'Saudi, Riyadh, Dammam, Al-Baha, Ramadan and Neon.',
    f3: 'Every standby scene', f3d: 'Dalla, Palm, Riyadh, Dammam and Al-Baha.',
    f6: 'Voice control', f6d: 'Voice names for your recipes with Alexa, Siri and NFC shortcuts, safety options and a command log.',
    f7: 'Device notifications', f7d: 'A "coffee ready" alert on your phone or tablet, even when moodots is closed.',
    f4: 'Feature updates, automatically', f4d: 'New Pro features and updates arrive on their own.',
    f5: 'moodots Cloud', f5d: 'Open moodots from anywhere at hub.nuqtasa.tools/app, with "coffee ready" alerts on your phone.',
    get: 'Get Pro', have: 'I have Pro · sign in', close: 'Close',
    how: 'After you buy, sign in here with the same email and everything unlocks right away.',
  },
};

const Icon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICONS = {
  f1: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  f2: 'M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.5 0-.9-.7-1.2-.7-2s.6-1.5 1.5-1.5H17a4 4 0 004-4c0-5-4-9-9-9zM7.5 11h.01M10.5 7.5h.01M15 7.5h.01',
  f3: 'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.6 5.6M18.4 18.4L17 17M7 17l-1.4 1.4M18.4 5.6L17 7M12 8a4 4 0 100 8 4 4 0 000-8z',
  f4: 'M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5',
  f5: 'M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8a4 4 0 01-1 10H7z',
  f6: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  f7: 'M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0',
};

export default function ProSheet({ lang, pro, onSignIn, onClose }) {
  const T = TX[lang] || TX.en;
  const [shot, setShot] = useState(true);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const proThemes = Object.keys(THEMES).filter((k) => !FREE_THEMES.includes(k));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pro-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T.title} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="pro-head">
          <Logo markSize={30} wordHeight={22} />
          <span className="pro-badge">PRO</span>
        </div>
        {pro ? (
          <div className="pro-active">
            <b>{T.activeTitle}</b>
            <span>{T.activeSub}</span>
          </div>
        ) : (
          <div className="pro-price">
            <span className="pro-amount" dir="ltr">{PRO_PRICE_SAR}</span>
            <span className="pro-cur">{T.price}</span>
            <span className="pro-once">{T.once}</span>
          </div>
        )}

        {shot && (
          <img className="pro-shot" src={`${HUB_URL}/brand/pro-analytics.png?v=1`} alt={T.f1}
            onError={() => setShot(false)} loading="lazy" />
        )}

        <ul className="pro-list">
          {['f1', 'f2', 'f3', 'f6', 'f7', 'f4', 'f5'].map((k) => (
            <li key={k}>
              <span className="pro-ic"><Icon d={ICONS[k]} /></span>
              <div>
                <b>{T[k]}</b>
                <span>{T[`${k}d`]}</span>
                {k === 'f2' && (
                  <div className="pro-swatches">
                    {proThemes.map((t) => <i key={t} style={{ background: THEMES[t].swatch }} title={THEMES[t].name[lang] || THEMES[t].name.en} />)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {!pro && <div className="cloud-note">{T.how}</div>}
        <div className="btn-row">
          {pro ? (
            <button className="nb nb-primary" onClick={onClose}>{T.close}</button>
          ) : (
            <>
              <button className="nb nb-secondary" onClick={onSignIn}>{T.have}</button>
              <a className="nb nb-primary" href={`${HUB_URL}/?from=app`} target="_blank" rel="noopener noreferrer">{T.get}</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function LockMark({ size = 12 }) {
  return (
    <svg className="lock-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}
