import React from 'react';
import { t } from '../utils/i18n';

// Keys match the fault strings server.py sends in state.fault
const FAULTS = {
  'Out of water': { title: 'faultNoWater', hint: 'faultNoWaterHint', icon: 'water' },
  'No beans': { title: 'faultNoBeans', hint: 'faultNoBeansHint', icon: 'beans' },
  'Dose/water error': { title: 'faultDose', hint: 'faultDoseHint', icon: 'water' },
  'Grinder gear error': { title: 'faultGear', hint: 'faultGearHint', icon: 'alert' },
  'Ended early': { title: 'faultShort', hint: 'faultShortHint', icon: 'alert' },
};

export function isMachineFault(fault) {
  return Boolean(FAULTS[fault]);
}

function FaultIcon({ kind }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'water') {
    return (
      <svg {...common}>
        <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
        <path d="M4 4l16 16" />
      </svg>
    );
  }
  if (kind === 'beans') {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(-30 12 12)" />
        <path d="M9 6.5c3 2 1 9 6 11" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </svg>
  );
}

// onSkipGrind: shown for "No beans" while the brew is waiting, to carry on with water only.
// short: { poured, total } for a brew the machine ended before the recipe was finished.
export default function FaultBanner({ fault, lang, onDismiss, onSkipGrind, short }) {
  const f = FAULTS[fault];
  if (!f) return null;
  const skip = fault === 'No beans' && onSkipGrind;
  const hint = skip ? t('faultNoBeansAsk', lang)
    : fault === 'Ended early' && short ? t('faultShortDetail', lang).replace('{poured}', short.poured).replace('{total}', short.total)
      : t(f.hint, lang);
  return (
    <div className="fault-banner" role="alert">
      <div className="fault-icon"><FaultIcon kind={f.icon} /></div>
      <div className="fault-text">
        <div className="fault-title">{t(f.title, lang)}</div>
        <div className="fault-hint">{hint}</div>
      </div>
      {skip && <button className="nb nb-primary nb-sm fault-action" onClick={onSkipGrind}>{t('skipGrind', lang)}</button>}
      <button className="fault-dismiss" onClick={onDismiss} aria-label={t('dismiss', lang)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
