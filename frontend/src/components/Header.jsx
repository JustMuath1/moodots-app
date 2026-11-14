import React, { useState } from 'react';
import { t } from '../utils/i18n';
import Clock from './Clock';
import Logo from './Logo';
import { THEMES } from '../utils/themes';

import { VoiceMark } from './VoicePage';

const REMOTE_TX = {
  ar: { remote: 'عن بُعد', noSignal: 'بلا إنترنت', machineOn: 'المكنة متصلة', unknown: 'المكنة ؟' },
  en: { remote: 'Remote', noSignal: 'No signal', machineOn: 'Machine on', unknown: 'Machine ?' },
};
const CLOUD = ['..aaa...', '.aaaaaa.', 'aaaaaaaa', 'aaaaaaaa'];
export function CloudDots() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">
      {CLOUD.flatMap((row, y) => [...row].map((ch, x) => (ch === 'a' ? <circle key={`${x}${y}`} cx={x * 3 + 1.5} cy={y * 3 + 1.5} r="1.2" fill="currentColor" /> : null)))}
    </svg>
  );
}

export default function Header({ lang, ble, soundOn, onToggleSound, fullscreen, onOpenConnection, onOpenAccount, onRestart, onToggleLang, theme, onOpenThemes, canCustomise, editing, onCustomise, page, onAnalytics, onNotify, pushOn, showAnalytics, analyticsLocked, onOpenSettings, remote, onVoice, voiceLocked }) {
  const [restarting, setRestarting] = useState(false);

  const isOn = ble === 'connected';
  const isScanning = ble === 'scanning' || ble === 'connecting';
  const away = remote ? (REMOTE_TX[lang] || REMOTE_TX.en) : null;
  const lost = remote === 'lost';
  const connLabel = lost ? away.unknown : isOn ? (away ? away.machineOn : t('connected', lang)) : isScanning ? t('scanning', lang) : t('disconnectedTap', lang);

  const handleRestart = async () => {
    setRestarting(true);
    await onRestart();
    setTimeout(() => setRestarting(false), 3000);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="wordmark">
          <Logo className="wordmark-logo" />
          <span className="wordmark-sub">{t('brandFor', lang)} <span dir="ltr">xBloom</span></span>
        </div>
        {away && <span className={`remote-pill${lost ? ' lost' : ''}`}><CloudDots />{lost ? away.noSignal : away.remote}</span>}
        <button className={`conn-pill ${lost ? 'unknown' : isOn ? 'on' : isScanning ? 'scanning' : 'off'}`} onClick={onOpenConnection}>
          <span className={`conn-dot ${lost ? 'off' : isOn ? 'on' : isScanning ? 'scanning' : 'off'}`} />
          {connLabel}
        </button>
      </div>
      <Clock lang={lang} className="clock-in-header" />
      <div className="header-actions">
        <button className="theme-pick" onClick={onOpenThemes} title={t('theme', lang)} aria-haspopup="dialog">
          <span className={`theme-sw${theme === 'neon' || theme === 'ice' ? ' glow' : ''}`} style={{ background: THEMES[theme].swatch, color: THEMES[theme].swatch }} />
          <span className="theme-name">{THEMES[theme].name[lang] || THEMES[theme].name.en}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {showAnalytics && <button className={`icon-btn analytics-btn${page === 'analytics' ? ' on' : ''}`} onClick={onAnalytics} title={t('analytics', lang)} aria-pressed={page === 'analytics'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
          {analyticsLocked && <span className="pro-dot" aria-label="Pro">PRO</span>}
        </button>}
        {onVoice && <button className={`icon-btn voice-btn${page === 'voice' ? ' on' : ''}`} onClick={onVoice} title={lang === 'ar' ? 'التحكم الصوتي' : 'Voice control'} aria-pressed={page === 'voice'}>
          <VoiceMark size={20} />
          {voiceLocked && <span className="pro-dot" aria-label="Pro">PRO</span>}
        </button>}
        {canCustomise && (
          <button className={`icon-btn customise-btn${editing ? ' on' : ''}`} onClick={onCustomise} title={t('customise', lang)} aria-pressed={editing}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" />
            </svg>
          </button>
        )}
        {fullscreen?.supported && (
          <button
            className="icon-btn hide-sm"
            onClick={fullscreen.toggle}
            title={t(fullscreen.active ? 'exitFullscreen' : 'enterFullscreen', lang)}
            aria-pressed={fullscreen.active}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {fullscreen.active
                ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        )}
        <button className={`icon-btn${pushOn ? ' on' : ''}`} onClick={onNotify} title={t('deviceNotify', lang)} aria-pressed={pushOn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          {pushOn && <span className="hdr-dot" />}
        </button>
        <button className="icon-btn hide-sm" onClick={onToggleLang} title="EN / AR">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
          </svg>
        </button>
        <button className={`icon-btn hide-sm${restarting ? ' spinning' : ''}`} onClick={handleRestart} title={t('restart', lang)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/>
            <path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>
          </svg>
        </button>
        <button className="icon-btn hide-sm" onClick={onOpenAccount} title={t('cloudAccount', lang)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
          </svg>
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title={t('settings', lang)} aria-haspopup="dialog">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
