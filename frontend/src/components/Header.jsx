import React, { useState } from 'react';
import { t } from '../utils/i18n';
import Clock from './Clock';
import Logo from './Logo';
import { THEMES } from '../utils/themes';

export default function Header({ lang, ble, soundOn, onToggleSound, fullscreen, onOpenConnection, onOpenAccount, onRestart, onToggleLang, theme, onOpenThemes, canCustomise, editing, onCustomise, page, onAnalytics, onNotify, pushOn, showAnalytics }) {
  const [restarting, setRestarting] = useState(false);

  const isOn = ble === 'connected';
  const isScanning = ble === 'scanning' || ble === 'connecting';
  const connLabel = isOn ? t('connected', lang) : isScanning ? t('scanning', lang) : t('disconnectedTap', lang);

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
        <button className={`conn-pill ${isOn ? 'on' : isScanning ? 'scanning' : 'off'}`} onClick={onOpenConnection}>
          <span className={`conn-dot ${isOn ? 'on' : isScanning ? 'scanning' : 'off'}`} />
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
            className="icon-btn"
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
        <button className="icon-btn" onClick={onToggleLang} title="EN / AR">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
          </svg>
        </button>
        <button className={`icon-btn${restarting ? ' spinning' : ''}`} onClick={handleRestart} title={t('restart', lang)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/>
            <path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>
          </svg>
        </button>
        <button className="icon-btn" onClick={onOpenAccount} title={t('cloudAccount', lang)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
