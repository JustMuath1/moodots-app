import React from 'react';
import { t } from '../utils/i18n';

// Hero controls: one button system (handoff v5). Primary = accent, secondary = surface,
// exit = transparent at the far end. Idle row ends with a segmented group of the single modes.

export function MachineChip({ lang, connected, machineName, onChangeMachine }) {
  if (!machineName) return null;
  return (
    <button className="brew-machine" onClick={onChangeMachine}>
      <span className={`conn-dot ${connected ? 'on' : 'off'}`} />
      <span className="brew-machine-label">{t('brewOn', lang)}</span>
      <span className="brew-machine-name" dir="ltr">{machineName}</span>
      <span className="brew-machine-change">{t('change', lang)}</span>
    </button>
  );
}

const Svg = ({ children, color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color }}>{children}</svg>
);
export const GrindIcon = () => (
  <Svg color="var(--accent)"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /></Svg>
);
export const WaterIcon = ({ color = 'var(--hot)' }) => (
  <Svg color={color}><path d="M12 3c3.5 4.2 6 7.4 6 10.4A6 6 0 0 1 6 13.4C6 10.4 8.5 7.2 12 3z" /></Svg>
);
export const ScaleIcon = () => (
  <Svg color="var(--accent)"><path d="M3 19h18" /><path d="M5 19l2-9h10l2 9" /><circle cx="12" cy="6" r="2.2" /></Svg>
);

const B = ({ kind = 'secondary', className = '', ...p }) => <button className={`nb nb-${kind} ${className}`} {...p} />;

export default function BrewControls({
  lang, connected, brewing, paused, recipeName,
  scale, onBrew, onTare, onDemo, onPause, onStop, onEnterScale, onExitScale, onTimerToggle,
  grind, onEnterGrind, onToggleGrind, onExitGrind,
  water, onEnterWater, onToggleWater, onExitWater, tankEmpty,
}) {
  if (water) {
    const label = water.running ? 'stopPour' : water.poured >= water.vol - 1 ? 'pourAgain' : water.poured > 0.5 ? 'continuePour' : 'pourWater';
    return (
      <div className="nb-row">
        <B kind="primary" onClick={onToggleWater} disabled={!water.running && tankEmpty}>
          {!water.running && <WaterIcon color="currentColor" />}
          <span>{t(label, lang)}</span>
        </B>
        <B onClick={onTare}>{t('tare', lang)}</B>
        <B kind="exit" onClick={onExitWater}>{t('exit', lang)}</B>
      </div>
    );
  }

  if (grind) {
    return (
      <div className="nb-row">
        <B kind="primary" onClick={onToggleGrind}>{t(grind.running ? 'stopGrinding' : 'grindAgain', lang)}</B>
        <B kind="exit" onClick={onExitGrind}>{t('exit', lang)}</B>
      </div>
    );
  }

  if (scale) {
    const timerLabel = scale.running ? t('stopTimer', lang) : scale.secs > 0 ? t('continueTimer', lang) : t('startTimer', lang);
    return (
      <div className="nb-row">
        <B kind="primary" onClick={onTimerToggle}>{timerLabel}</B>
        <B onClick={onTare}>{t('tare', lang)}</B>
        <B kind="exit" onClick={onExitScale}>{t('exit', lang)}</B>
      </div>
    );
  }

  if (brewing) {
    return (
      <div className="nb-row">
        <B className="nb-wide nb-bold" onClick={onPause}>{paused ? t('resume', lang) : t('pause', lang)}</B>
        <B kind="stop" onClick={onStop}>{t('stop', lang)}</B>
      </div>
    );
  }

  return (
    <div className="nb-row">
      <B kind="primary" onClick={onBrew} disabled={!connected}
        title={recipeName ? `${t('brew', lang)} · ${recipeName}` : undefined}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 4.5v15L5 12z" /></svg>
        <span>{connected ? t('brew', lang) : t('connectToBrew', lang)}</span>
      </B>
      {connected
        ? <B onClick={onTare}>{t('tare', lang)}</B>
        : <B className="nb-demo" onClick={onDemo} title={t('demoHint', lang)}>{t('demo', lang)}</B>}
      <div className="nb-seg" role="group" aria-label={t('singleModes', lang)}>
        <button className="nb-seg-btn" onClick={onEnterGrind} disabled={!connected}><GrindIcon /><span>{t('grindOnly', lang)}</span></button>
        <button className="nb-seg-btn" onClick={onEnterWater} disabled={!connected || tankEmpty}><WaterIcon /><span>{t('waterOnly', lang)}</span></button>
        <button className="nb-seg-btn" onClick={onEnterScale} disabled={!connected}><ScaleIcon /><span>{t('scaleOnly', lang)}</span></button>
      </div>
    </div>
  );
}

// Water-only settings: temperature chips, volume stepper, pour pattern. Locked while pouring.
export const WATER_TEMPS = [[20, 'room'], [85, '85°'], [90, '90°'], [93, '93°'], [96, '96°']];
export const WATER_PATTERNS = [['centered', 1], ['circular', 3], ['spiral', 2]];

export function WaterPanel({ lang, water, onChange }) {
  const locked = water.running;
  const pct = Math.min(100, (100 * water.poured) / water.vol);
  return (
    <div className="water-panel">
      <div className="water-fill" role="progressbar" aria-label={t('pourProgress', lang)}
        aria-valuemin={0} aria-valuemax={water.vol} aria-valuenow={Math.round(water.poured)}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="water-line">
        <span className="water-label">{t('temperature', lang)}</span>
        <div className="water-chips">
          {WATER_TEMPS.map(([v, n]) => (
            <button key={v} className={`water-chip${water.temp === v ? ' on' : ''}`} disabled={locked}
              onClick={() => onChange({ temp: v })}>{n === 'room' ? t('roomTemp', lang) : <span dir="ltr">{n}</span>}</button>
          ))}
        </div>
      </div>
      <div className="water-line">
        <span className="water-label">{t('amount', lang)}</span>
        <div className="water-stepper">
          <button disabled={locked || water.vol <= 30} aria-label={t('less', lang)} onClick={() => onChange({ vol: Math.max(30, water.vol - 10) })}>−</button>
          <span><span dir="ltr" className="water-vol">{water.vol}</span> {t('ml', lang)}</span>
          <button disabled={locked || water.vol >= 500} aria-label={t('more', lang)} onClick={() => onChange({ vol: Math.min(500, water.vol + 10) })}>+</button>
        </div>
      </div>
      <div className="water-line">
        <span className="water-label">{t('pourPattern', lang)}</span>
        <div className="water-seg" role="group" aria-label={t('pourPattern', lang)}>
          {WATER_PATTERNS.map(([k]) => (
            <button key={k} className={water.pat === k ? 'on' : ''} disabled={locked} onClick={() => onChange({ pat: k })}>{t(`pat_${k}`, lang)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
