import React from 'react';
import { t } from '../utils/i18n';
import BrewCurve from './BrewCurve';

// Brewing path (Tablet.dc.html): one node per step, waits folded into the step before ("· +30ث"), then "جاهز".
function buildSteps(recipe, lang) {
  const ar = lang === 'ar';
  const g = ar ? 'غ' : 'g';
  const ml = ar ? 'مل' : 'ml';
  const sec = ar ? 'ث' : 's';
  const steps = [];
  if (recipe.grinder_on !== false && recipe.grind_size > 0) {
    steps.push({ kind: 'grind', label: t('stepGrind', lang), sub: `${recipe.dose_g ?? 15} ${g} · #${recipe.grind_size}` });
  }
  steps.push({ kind: 'heat', label: t('stepHeat', lang), sub: `${recipe.pours?.[0]?.temp_c ?? 93}°` });
  let cum = 0;
  (recipe.pours || []).forEach((p, i) => {
    const from = cum;
    cum += p.volume_ml || 0;
    const bloom = i === 0 && recipe.pours.length > 1;
    steps.push({
      kind: 'pour',
      label: bloom ? t('stepBloom', lang) : (ar ? `صبّة ${i + 1}` : `Pour ${i + 1}`),
      sub: `${Math.round(p.volume_ml)} ${ml} · ${p.temp_c ?? 93}°${p.pause_s > 0 ? ` · +${p.pause_s}${sec}` : ''}`,
      from,
      to: cum,
    });
  });
  steps.push({ kind: 'done', label: t('stepDone', lang), sub: `${Math.round(cum)} ${ml}` });
  return { steps, total: cum };
}

// status: 'todo' | 'active' | 'done'; progress 0..1 for the connector after each node
function resolve(steps, { brewing, done, grinding, poured, heating }) {
  if (done) return steps.map(() => ({ status: 'done', progress: 1 }));
  if (!brewing) return steps.map(() => ({ status: 'todo', progress: 0 }));
  const pourStarted = poured > 0.5 && !grinding;
  let activeFound = false;
  return steps.map((s) => {
    if (activeFound) return { status: 'todo', progress: 0 };
    if (s.kind === 'grind') {
      if (pourStarted || heating) return { status: 'done', progress: 1 };
      activeFound = true;
      return { status: 'active', progress: 0 };
    }
    if (s.kind === 'heat') {
      if (pourStarted) return { status: 'done', progress: 1 };
      activeFound = true;
      return { status: 'active', progress: 0 };
    }
    if (s.kind === 'pour') {
      if (poured >= s.to - 0.5) return { status: 'done', progress: 1 };
      activeFound = true;
      const frac = Math.max(0, Math.min(1, (poured - s.from) / Math.max(1, s.to - s.from)));
      return { status: 'active', progress: frac };
    }
    activeFound = true;
    return { status: 'active', progress: 0 };
  });
}

export default function PourTimeline({ recipe, lang, brewing, done, grinding, heating, waiting, paused, poured, view = 'path', onView, curve }) {
  if (!recipe?.pours?.length) return null;
  const { steps, total } = buildSteps(recipe, lang);
  const states = resolve(steps, { brewing, done, grinding, poured, heating });

  return (
    <section className={`pour-timeline tl${paused ? ' paused' : ''}`} aria-label={t('timeline', lang)}>
      <div className="tl-head">
        <span className="tl-title">{t('timeline', lang)} · <span dir="auto">{recipe.name}</span></span>
        {onView && view !== 'both' && (
          <span className="tl-switch" role="group">
            <button className={view === 'path' ? 'on' : ''} onClick={() => onView('path')}>{lang === 'ar' ? 'المسار' : 'Path'}</button>
            <button className={view === 'curve' ? 'on' : ''} onClick={() => onView('curve')}>{lang === 'ar' ? 'المنحنى' : 'Curve'}</button>
          </span>
        )}
        <span className="tl-total" dir="ltr">{Math.round(total)}</span>
      </div>
      {view !== 'curve' && <ol className="tl-track" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const st = states[i].status;
          return (
            <li key={i} className={`tl-step ${st}${st === 'active' && waiting && !paused ? ' waiting' : ''}`} aria-current={st === 'active' ? 'step' : undefined}>
              <div className="tl-rail">
                <span className="tl-dot" />
                {i < steps.length - 1 && <span className="tl-line" />}
              </div>
              <span className="tl-label">{s.label}</span>
              <span className="tl-sub">{s.sub}</span>
            </li>
          );
        })}
      </ol>}
      {view !== 'path' && curve && <BrewCurve lang={lang} live={curve.live} best={curve.best} total={total} nowLabel={curve.nowLabel} compact={view === 'curve'} />}
    </section>
  );
}
