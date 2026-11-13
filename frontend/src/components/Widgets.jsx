import React from 'react';
import { rowsOf } from '../utils/layout';
import { VERSES, MORNING_DHIKR, isHot, hourLabel } from '../services/addons';
import { isColdRecipe } from '../utils/recipes';
import { tankInfo } from './TankStrip';
import AnalyticsWidget, { ANALYTICS_KINDS } from './AnalyticsWidgets';

// Every home component in every size (Widget.dc.html). Content changes per size; it never just stretches.
// Big variants reuse the existing screens (ctx.blocks); the rest are compact versions built here.

const TX = {
  ar: {
    brew: 'تحضير', brewing: 'التحضير', tare: 'تصفير', grindOnly: 'طحن فقط', scaleOnly: 'ميزان فقط', pause: 'إيقاف مؤقت', resume: 'استئناف', stop: 'إيقاف',
    grams: 'غرام', target: 'الهدف', grinder: 'المطحنة', brewer: 'المُحضّر', degree: 'الدرجة', rpm: 'دورة/د', celsius: '°م', ml: 'مل', mlMin: 'مل/د',
    nextStep: 'الخطوة التالية', of: 'من', path: 'مسار التحضير', weather: 'الطقس', hi: 'ع', lo: 'ص', hotTip: 'حار اليوم · جرّب', cold: 'بارداً',
    next: 'التالي', recipe: 'الوصفة', change: 'تغيير', recipes: 'الوصفات', hot: 'ساخن', coldTag: 'بارد', scale: 'الميزان', gps: 'غ/ث', g: 'غ',
    left: 'متبقٍ', over: 'زيادة', startTimer: 'بدء المؤقت', stopTimer: 'إيقاف المؤقت', nextBrew: 'التحضير التالي', noSchedule: 'لا جداول',
    today: 'اليوم', tomorrow: 'غداً', tank: 'الخزان',
  },
  en: {
    brew: 'Brew', brewing: 'Brew', tare: 'Tare', grindOnly: 'Grind only', scaleOnly: 'Scale only', pause: 'Pause', resume: 'Resume', stop: 'Stop',
    grams: 'g', target: 'target', grinder: 'Grinder', brewer: 'Brewer', degree: 'Size', rpm: 'RPM', celsius: '°C', ml: 'ml', mlMin: 'ml/min',
    nextStep: 'Next step', of: 'of', path: 'Brewing path', weather: 'Weather', hi: 'H', lo: 'L', hotTip: 'Hot today · try', cold: 'cold',
    next: 'Next', recipe: 'Recipe', change: 'Change', recipes: 'Recipes', hot: 'Hot', coldTag: 'Cold', scale: 'Scale', gps: 'g/s', g: 'g',
    left: 'left', over: 'over', startTimer: 'Start timer', stopTimer: 'Stop timer', nextBrew: 'Next brew', noSchedule: 'No schedules',
    today: 'Today', tomorrow: 'Tomorrow', tank: 'Water tank',
  },
};
const tx = (lang) => TX[lang] || TX.en;



function Num({ children, size, hot, style }) {
  return <span className={`wg-num${hot ? ' hot' : ''}`} dir="ltr" style={{ fontSize: size, ...style }}>{children}</span>;
}

/* ───────────── core components ───────────── */

function Brew({ v, c }) {
  const T = tx(c.lang);
  if (v === 'L') return c.blocks.brewL;
  const controls = c.isBrewing ? (
    <>
      <button className="wg-btn" onClick={c.togglePause}>{c.isPaused ? T.resume : T.pause}</button>
      <button className="wg-btn stop" onClick={c.stopBrew}>{T.stop}</button>
    </>
  ) : null;
  if (v === 'S') {
    return (
      <>
        <span className="wg-label">{T.brewing} · <span dir="auto">{c.recipeName}</span></span>
        <div className="wg-center"><Num size={48}>{c.weight.toFixed(1)}</Num></div>
        {c.isBrewing
          ? <div className="wg-row2">{controls}</div>
          : <button className="wg-btn primary big" onClick={c.startBrew} disabled={!c.isConnected}>{T.brew}</button>}
      </>
    );
  }
  return (
    <>
      <div className="wg-line">
        <span className={`phase-pill ${c.phaseClass}`}>{c.phase}</span>
        <span className="wg-strong ellipsis" dir="auto">{c.recipeName}</span>
      </div>
      <div className="wg-brew-m">
        <div className="wg-col">
          <Num size={56}>{c.weight.toFixed(1)}</Num>
          <span className="wg-muted">{T.grams} · {T.target} <span dir="ltr">{c.targetMl}</span></span>
        </div>
        <div className="wg-brew-m-ctl">
          {c.isBrewing ? controls : (
            <>
              <button className="wg-btn primary wide" onClick={c.startBrew} disabled={!c.isConnected}>{T.brew}</button>
              <button className="wg-btn" onClick={c.tare} disabled={!c.isConnected}>{T.tare}</button>
              <button className="wg-btn" onClick={c.enterGrind} disabled={!c.isConnected}>{T.grindOnly}</button>
              <button className="wg-btn" onClick={c.enterScale} disabled={!c.isConnected}>{T.scaleOnly}</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Timeline({ v, c }) {
  const T = tx(c.lang);
  if (v === 'L') return c.blocks.timelineL;
  const nodes = c.timelineNodes;
  if (v === 'S') {
    const curIdx = Math.max(0, nodes.findIndex((n) => n.active));
    const cur = nodes[curIdx] || nodes[0];
    return (
      <>
        <div className="wg-line between"><span className="wg-label">{T.nextStep}</span><span className="wg-dim">{curIdx + 1} {T.of} {nodes.length}</span></div>
        <div className="wg-line baseline"><span className="wg-title">{cur?.name}</span><span className="wg-sub">{cur?.detail}</span></div>
        <div className="wg-bar"><div style={{ width: `${Math.round(((curIdx + 1) / Math.max(1, nodes.length)) * 100)}%` }} /></div>
      </>
    );
  }
  return c.blocks.timelineM;
}

/* (brewing path medium = the earlier pour timeline card) */
function _unusedTimelineM({ c }) {
  const T = tx(c.lang);
  const nodes = c.timelineNodes;
  return (
    <div className="wg-timeline">
      <div className="wg-tl-head">
        <span className="wg-strong">{T.path}</span>
        <span className="wg-muted ellipsis"><span dir="auto">{c.recipeName}</span> · <span dir="ltr">{c.targetMl}</span> {T.ml}</span>
      </div>
      <div className="wg-tl-nodes" style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}>
        {nodes.map((n, i) => (
          <div key={i} className={`wg-node${n.active ? ' active' : n.done ? ' done' : ''}${n.active && c.isWaiting ? ' waiting' : ''}`}>
            <div className="wg-node-rail"><span className="wg-node-dot" />{i < nodes.length - 1 && <span className="wg-node-line" />}</div>
            <span className="wg-node-name">{n.name}</span>
            <span className="wg-node-detail">{n.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Grinder({ v, c }) {
  const T = tx(c.lang);
  if (v === 'M') return c.blocks.grinderM;
  return (
    <>
      <span className="wg-label">{T.grinder}</span>
      <div className="wg-line baseline"><Num size={38}>{c.grinder.size}</Num><span className="wg-muted">{T.degree}</span></div>
    </>
  );
}

function Brewer({ v, c }) {
  const T = tx(c.lang);
  if (v === 'M') return c.blocks.brewerM;
  return (
    <>
      <span className="wg-label">{T.brewer}</span>
      <div className="wg-line baseline"><Num size={38} hot={c.brewer.hot}>{c.brewer.temp}</Num><span className="wg-muted">{T.celsius}</span></div>
    </>
  );
}

function Tank({ v, c }) {
  const T = tx(c.lang);
  if (v === 'M') return c.blocks.tankM;
  const info = tankInfo(c.tank.ml, c.tank.cap, c.targetMl, c.isConnected);
  return (
    <>
      <span className="wg-label">{T.tank}</span>
      <div className="wg-line baseline"><Num size={34} hot={info.low}>{Math.round(info.ml)}</Num><span className="wg-muted">{T.ml}</span></div>
      <div className={`tank-bar wg-tank-bar${info.low ? ' low' : ''}`}><div style={{ width: `${Math.round(100 * info.pct)}%` }} /></div>
    </>
  );
}

function Recipes({ v, c }) {
  const T = tx(c.lang);
  if (v === 'L') return c.blocks.recipesL;
  const list = c.recipes;
  if (v === 'S') {
    const r = list[c.selectedRecipe];
    const cold = r && isColdRecipe(r, c.recipeTags);
    return (
      <>
        <span className="wg-label">{T.recipe}</span>
        <div className="wg-col gap6">
          <span className="wg-title ellipsis" dir="auto">{r?.name || '—'}</span>
          {r && <span className={`recipe-tag ${cold ? 'cold' : 'hot'} self-start`}>{cold ? T.coldTag : T.hot}</span>}
        </div>
        <button className="wg-btn" onClick={() => c.selectRecipe((c.selectedRecipe + 1) % Math.max(1, list.length))}>{T.change}</button>
      </>
    );
  }
  return (
    <>
      <span className="wg-label">{T.recipes}</span>
      <div className="wg-list">
        {list.slice(0, 6).map((r, i) => {
          const cold = isColdRecipe(r, c.recipeTags);
          return (
            <button key={r.id || r.name} className={`wg-list-row${i === c.selectedRecipe ? ' on' : ''}`} onClick={() => c.selectRecipe(i)}>
              <span className="ellipsis grow" dir="auto">{r.name}</span>
              <span className={`recipe-tag ${cold ? 'cold' : 'hot'}`}>{cold ? T.coldTag : T.hot}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ClockW({ v, c }) {
  const d = c.now;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ar = c.lang === 'ar';
  const hijriLoc = ar ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-GB-u-ca-islamic-umalqura';
  const gregLoc = ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  if (v === 'S') {
    return (
      <div className="wg-col center gap4">
        <Num size={44}>{hh}<span className="xb-blink">:</span>{mm}</Num>
        <span className="wg-muted">{d.toLocaleDateString(hijriLoc, { day: 'numeric', month: 'long' })}</span>
      </div>
    );
  }
  return (
    <div className="wg-line gap16">
      <Num size={48}>{hh}<span className="xb-blink">:</span>{mm}</Num>
      <div className="wg-col grow min0">
        <span className="wg-strong ellipsis">{d.toLocaleDateString(hijriLoc, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span className="wg-muted ellipsis">{d.toLocaleDateString(gregLoc, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
  );
}

function ScaleW({ v, c }) {
  const T = tx(c.lang);
  const w = Math.max(0, c.weight);
  if (v === 'S') {
    return (
      <>
        <span className="wg-label">{T.scale}</span>
        <div className="wg-line between"><Num size={34}>{w.toFixed(1)}</Num><button className="wg-btn sm" onClick={c.tare} disabled={!c.isConnected}>{T.tare}</button></div>
      </>
    );
  }
  const target = c.scale?.target || c.scaleTarget;
  const pct = Math.round((100 * w) / target);
  const over = w > target;
  return (
    <>
      <span className="wg-label">{T.scale}</span>
      <div className="wg-col gap8">
        <div className="wg-line between baseline"><Num size={52}>{w.toFixed(1)}</Num><span className="wg-muted">{T.g} · <span dir="ltr">{c.pourRate}</span> {T.gps}</span></div>
        <div className={`gauge-bar${over ? ' over' : ''}`}><div className="gauge-fill" style={{ width: `${Math.min(100, pct)}%` }} /></div>
        <div className="wg-line between wg-small"><span dir="ltr">{pct}%</span><span>{over ? T.over : T.left} <span dir="ltr">{Math.round(Math.abs(target - w))}</span> {T.g}</span></div>
      </div>
      <div className="wg-row21">
        <button className="wg-btn primary" onClick={c.scaleTimerToggle} disabled={!c.isConnected}>{c.scale?.running ? T.stopTimer : T.startTimer}</button>
        <button className="wg-btn" onClick={c.tare} disabled={!c.isConnected}>{T.tare}</button>
      </div>
    </>
  );
}

function Schedule({ v, c }) {
  const T = tx(c.lang);
  const n = c.nextSchedule;
  if (!n) return (<><span className="wg-label">{T.nextBrew}</span><span className="wg-muted">{T.noSchedule}</span></>);
  if (v === 'S') {
    return (<><span className="wg-label">{T.nextBrew}</span><Num size={38}>{n.time}</Num></>);
  }
  return (
    <div className="wg-line between gap12">
      <div className="wg-col gap4"><span className="wg-label">{T.nextBrew}</span><Num size={40}>{n.time}</Num></div>
      <div className="wg-col end gap2"><span className="wg-strong">{n.dayLabel}</span><span className="wg-muted ellipsis" dir="auto">{n.recipe}</span></div>
    </div>
  );
}

/* ───────────── add-ons ───────────── */

function Weather({ v, c }) {
  const T = tx(c.lang);
  const w = c.weather;
  const L = c.lang === 'ar' ? 'ar' : 'en';
  if (!w) {
    return (
      <>
        <span className="wg-label">{T.weather}</span>
        <Num size={v === 'S' ? 42 : 38} style={{ opacity: 0.35 }}>--°</Num>
      </>
    );
  }
  const hot = isHot(w.temp);
  if (v === 'S') {
    return (
      <>
        <div className="wg-line between"><span className="wg-label">{w.city[L]}</span><span className="wg-sub">{w.cond[L]}</span></div>
        <Num size={42} hot={hot} style={{ textAlign: 'end' }}>{w.temp}°</Num>
      </>
    );
  }
  if (v === 'M') {
    return (
      <div className="wg-line gap12">
        <Num size={38} hot={hot}>{w.temp}°</Num>
        <div className="wg-col grow min0"><span className="wg-strong ellipsis">{w.city[L]} · {w.cond[L]}</span><span className="wg-muted">{T.hi} {w.hi}° · {T.lo} {w.lo}°</span></div>
        <div className="wg-hours">{w.hourly.slice(0, 3).map((h) => <div key={h.time} className="wg-hour"><span>{hourLabel(h.time, L)}</span><Num size={14}>{h.temp}°</Num></div>)}</div>
      </div>
    );
  }
  return (
    <>
      <div className="wg-line between gap12">
        <div className="wg-col"><span className="wg-label">{T.weather} · {w.city[L]}</span><span className="wg-sub">{w.cond[L]} · {T.hi} {w.hi}° {T.lo} {w.lo}°</span></div>
        <Num size={40} hot={hot}>{w.temp}°</Num>
      </div>
      <div className="wg-hours four">{w.hourly.map((h) => <div key={h.time} className="wg-hour"><span>{hourLabel(h.time, L)}</span><Num size={16}>{h.temp}°</Num></div>)}</div>
      {hot && c.coldSuggestion && <div className="wg-tip">{T.hotTip} <b dir="auto">{c.coldSuggestion}</b> {T.cold}</div>}
    </>
  );
}

function Verse({ v, c }) {
  const T = tx(c.lang);
  const verse = VERSES[c.verseIndex % VERSES.length];
  if (v === 'S') {
    return (
      <button className="wg-plain" onClick={c.nextVerse} aria-label={T.next}>
        <span className="wg-chip ok">{verse.k}</span>
        <p className="wg-amiri ellipsis" style={{ fontSize: 18 }}>{verse.t}</p>
      </button>
    );
  }
  if (v === 'M') {
    return (
      <div className="wg-line gap12">
        <div className="wg-col grow min0 gap2">
          <span className="wg-muted"><b className="wg-ok">{verse.k}</b> · {verse.ref}</span>
          <p className="wg-amiri ellipsis" style={{ fontSize: 22 }}>{verse.t}</p>
        </div>
        <button className="wg-icon-btn" onClick={c.nextVerse} aria-label={T.next}>‹</button>
      </div>
    );
  }
  return (
    <>
      <div className="wg-line between"><span className="wg-chip ok">{verse.k}</span><button className="wg-icon-btn sm" onClick={c.nextVerse} aria-label={T.next}>‹</button></div>
      <div className="wg-col gap4"><p className="wg-amiri" style={{ fontSize: 26, lineHeight: 1.6 }}>{verse.t}</p><span className="wg-muted">{verse.ref}</span></div>
      <div className="wg-divider" />
      <div className="wg-col gap4">
        <span className="wg-muted">{MORNING_DHIKR.title}</span>
        <p className="wg-amiri dhikr">{MORNING_DHIKR.t}</p>
        <span className="wg-dim">{MORNING_DHIKR.ref}</span>
      </div>
    </>
  );
}

const KINDS = { brew: Brew, timeline: Timeline, grinder: Grinder, brewer: Brewer, tank: Tank, recipes: Recipes, clock: ClockW, scale: ScaleW, schedule: Schedule, weather: Weather, verse: Verse };
// variants that reuse an existing full screen part (they bring their own card)
const BLOCKS = { timelineL: true, brewL: 1, grinderM: 1, brewerM: 1, recipesL: 1, timelineM: 1 };

export default function Widget({ kind, variant, ctx }) {
  if (ANALYTICS_KINDS[kind]) {
    return <div className="wg-block an-block"><AnalyticsWidget kind={kind} a={ctx.analytics} lang={ctx.lang} onAddBag={ctx.openBeans} /></div>;
  }
  const Comp = KINDS[kind];
  if (!Comp) return null;
  if (BLOCKS[kind + variant]) return <div className="wg-block">{<Comp v={variant} c={ctx} />}</div>;
  const one = rowsOf(kind, variant) === 1;
  return (
    <div className={`wg ${one ? 'one' : 'multi'} wg-${kind} wg-${kind}-${variant}`}>
      <Comp v={variant} c={ctx} />
    </div>
  );
}
