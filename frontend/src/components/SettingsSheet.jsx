import React, { useState } from 'react';
import { t } from '../utils/i18n';

// Settings popup — groups the less-used header controls (language, fullscreen, restart, account) so
// small screens don't crowd the header. Shown from the gear button; on wide screens those controls
// stay inline in the header instead.
const TX = {
  ar: { cloud: 'Nuqta Cloud', cloudOpen: 'فتح', title: 'الإعدادات', language: 'اللغة', fullscreen: 'ملء الشاشة', fsOn: 'تشغيل', fsOff: 'إيقاف', restart: 'إعادة تشغيل الخادم', restarting: 'جارٍ…', account: 'حساب xBloom', accountOpen: 'فتح', close: 'إغلاق' },
  en: { cloud: 'Nuqta Cloud', cloudOpen: 'Open', title: 'Settings', language: 'Language', fullscreen: 'Fullscreen', fsOn: 'On', fsOff: 'Off', restart: 'Restart server', restarting: 'Restarting…', account: 'xBloom account', accountOpen: 'Open', close: 'Close' },
};

export default function SettingsSheet({ lang, fullscreen, onToggleLang, onRestart, onOpenAccount, onOpenCloud, onClose }) {
  const T = TX[lang] || TX.en;
  const [restarting, setRestarting] = useState(false);
  const restart = async () => { setRestarting(true); await onRestart(); setTimeout(() => setRestarting(false), 3000); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-form" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T.title}>
        <div className="modal-title">{T.title}</div>

        <div className="alert-row">
          <div className="alert-text"><b>{T.language}</b></div>
          <div className="pk-seg lang-seg" role="group" aria-label={T.language}>
            <button className={lang === 'ar' ? 'on' : ''} onClick={() => { if (lang !== 'ar') onToggleLang(); }}>العربية</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => { if (lang !== 'en') onToggleLang(); }}>English</button>
          </div>
        </div>

        {fullscreen?.supported && (
          <>
            <div className="alert-sep" />
            <div className="alert-row">
              <div className="alert-text"><b>{T.fullscreen}</b></div>
              <button className={`switch${fullscreen.active ? ' on' : ''}`} role="switch" aria-checked={fullscreen.active} aria-label={T.fullscreen} onClick={fullscreen.toggle} />
            </div>
          </>
        )}

        {onOpenCloud && (
          <>
            <div className="alert-sep" />
            <div className="alert-row">
              <div className="alert-text"><b>{T.cloud}</b></div>
              <button className="nb nb-secondary nb-sm" onClick={() => { onClose(); onOpenCloud(); }}>{T.cloudOpen}</button>
            </div>
          </>
        )}

        <div className="alert-sep" />
        <div className="alert-row">
          <div className="alert-text"><b>{T.account}</b></div>
          <button className="nb nb-secondary nb-sm" onClick={() => { onClose(); onOpenAccount(); }}>{T.accountOpen}</button>
        </div>

        <div className="alert-sep" />
        <div className="alert-row">
          <div className="alert-text"><b>{T.restart}</b></div>
          <button className="nb nb-secondary nb-sm" onClick={restart} disabled={restarting}>{restarting ? T.restarting : T.restart}</button>
        </div>

        <div className="btn-row">
          <button className="nb nb-secondary" onClick={onClose}>{T.close}</button>
        </div>
      </div>
    </div>
  );
}
