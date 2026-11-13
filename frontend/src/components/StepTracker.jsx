import React from 'react';
import { t } from '../utils/i18n';

// The 5-step tracker beside the status badge: grind · heat · bloom · pour · ready
const STEPS = ['stepGrind', 'stepHeat', 'stepBloom', 'stepPour', 'stepDone'];

export default function StepTracker({ lang, current, done, brewing, waiting, noGrind }) {
  return (
    <div className="step-tracker" aria-label={t('brewSteps', lang)}>
      {STEPS.map((key, i) => {
        const skipped = i === 0 && noGrind;
        const isDone = done || (brewing && i < current);
        const active = brewing && i === current;
        const cls = skipped ? 'skipped' : active ? `active${waiting ? ' waiting' : ''}` : isDone ? 'done' : '';
        return (
          <div key={key} className={`st-step ${cls}`} aria-current={active ? 'step' : undefined}>
            <span className="st-dot" />
            <span className="st-label">{skipped ? t('noGrind', lang) : t(key, lang)}</span>
            {i < STEPS.length - 1 && <span className={`st-line${isDone ? ' done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}
