import React, { useState } from 'react';
import { t } from '../utils/i18n';
import Skeleton from './Skeleton';

export const TANK_LOW_ML = 300;

// Dotted level icon: 3 columns × 6 rows, lit from the bottom up.
export function TankIcon({ pct, low, on }) {
  const lit = on ? Math.round(pct * 6) : 0;
  return (
    <span className="tank-icon" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => {
        const row = 5 - Math.floor(i / 3);
        return <span key={i} className={row < lit ? (low ? 'lit low' : 'lit') : ''} />;
      })}
    </span>
  );
}

export function tankInfo(tankMl, tankCap, cupMl, connected) {
  const ml = connected ? Math.max(0, tankMl || 0) : 0;
  const cap = tankCap || 1200;
  const pct = Math.min(1, ml / cap);
  const low = connected && ml < TANK_LOW_ML;
  const empty = connected && ml <= 0;
  const cups = Math.floor(ml / Math.max(50, cupMl || 250));
  return { ml, cap, pct, low, empty, cups };
}

export function tankStatus(info, connected, lang, out) {
  if (!connected) return t('disconnected', lang);
  if (out) return t('tankOut', lang);
  if (info.empty) return t('tankEmpty', lang);
  if (info.low) return t('tankLow', lang);
  return t('tankCups', lang).replace('{n}', info.cups);
}

// Water tank strip: level icon, status, ml left and a blue level bar (red when low).
// Tap to mark the tank as refilled.
export default function TankStrip({ lang, connected, tankMl, tankCap, cupMl, loading, onRefill, compact, out, back, onKeep, onBackDone }) {
  const [ask, setAsk] = useState(false);
  const info = tankInfo(tankMl, tankCap, cupMl, connected);
  const status = tankStatus(info, connected, lang, out);
  const low = info.low || (connected && out);
  return (
    <section className={`strip-card tank-card${low ? ' low' : ''}`} aria-label={t('waterTank', lang)}>
      <div className="strip-row">
        {!compact && <TankIcon pct={out ? 0 : info.pct} low={low} on={connected} />}
        <div className="strip-info">
          <span className="strip-title">{t('tank', lang)}</span>
          <span className={`strip-status${low ? ' hot' : ''}`}>{status}</span>
        </div>
        {loading ? <Skeleton className="skel-strip-2" /> : (
          <button className="strip-stat tank-stat" onClick={() => connected && setAsk(true)} aria-label={t('tankRefilled', lang)}>
            <span className="strip-val" dir="ltr">{Math.round(info.ml)}</span>
            <span className="strip-label">{t('mlLeft', lang)}</span>
          </button>
        )}
      </div>
      {back ? (
        <div className="tank-ask">
          <span>{t('tankBackQ', lang)}</span>
          <button className="nb nb-primary nb-sm" onClick={onBackDone}>{t('tankFull', lang)}</button>
          <button className="nb nb-secondary nb-sm" onClick={onKeep}>{t('tankAsBefore', lang).replace('{n}', back.prev)}</button>
        </div>
      ) : ask ? (
        <div className="tank-ask">
          <span>{t('tankRefillQ', lang)}</span>
          <button className="nb nb-primary nb-sm" onClick={() => { onRefill(); setAsk(false); }}>{t('tankRefilled', lang)}</button>
          <button className="nb nb-secondary nb-sm" onClick={() => setAsk(false)}>{t('cancel', lang)}</button>
        </div>
      ) : (
        <div className="strip-bar tank-bar"><div style={{ width: `${Math.round(100 * info.pct)}%` }} /></div>
      )}
    </section>
  );
}
