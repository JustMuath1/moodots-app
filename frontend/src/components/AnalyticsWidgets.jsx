import React, { useState, useCallback } from 'react';

// The 11 analytics widgets (analytics-spec.md §2–4, design/Analytics.dc.html).
// Data comes from GET /api/analytics (computed on the server). Numbers use Doto, dir="ltr".
// Charts that run over time are dir="ltr" so time goes left → right.
// Hover (mouse) or tap (touch) any dot or bar to see its value.

export const CATEGORICAL = ['#D4733A', '#3987E5', '#199E70', '#9085E9'];

const TX = {
  ar: {
    heatmap: 'خريطة الاستهلاك · آخر 6 أشهر', less: 'أقل', more: 'أكثر', cupsMonth: 'كوباً هذا الشهر', longest: 'أطول سلسلة (يوم)',
    days: ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'], week: 'الأسبوع', cups: 'أكواب', cup: 'كوب',
    hours: 'أوقات التحضير', peak: 'الذروة', am: 'ص', pm: 'م', before10: 'من تحضيراتك قبل ١٠ صباحاً', brews: 'تحضير',
    need5: 'يحتاج ٥ تحضيرات على الأقل',
    consistency: 'ثبات الوصفة · مدة التحضير', last30: 'آخر 30 تحضيراً', sec: 'ث', needRecipe: 'يظهر بعد ٥ تحضيرات مكتملة لوصفة',
    median: 'الوسيط', target: 'الهدف',
    share: 'حصة الوصفات · هذا الشهر', others: 'أخرى',
    water: 'الماء أسبوعياً', refills: 'تعبئات للخزان هذا الأسبوع', weeksAgo: 'قبل 8 أسابيع', thisWeek: 'هذا الأسبوع', litre: 'ل',
    grade: 'التقييم مقابل درجة الطحن', best: 'الأفضل', rateToSee: 'قيّم تحضيراتك بالنجوم لتظهر النتيجة',
    cold: 'البارد مقابل الطقس', coldSub: '٪ تحضيرات باردة / أسبوع', per5: (n) => `كل ٥° زيادة ← ${n > 0 ? '+' : ''}${n}٪ بارد تقريباً`,
    tempNote: 'الأرقام = متوسط حرارة الأسبوع', coldPct: 'بارد',
    cost: 'تكلفة الكوب', sar: 'ر.س', vsLast: 'عن الشهر الماضي', addPrice: 'أضف سعر كيس البن',
    ratio: 'النسبة الفعلية', inRange: 'ضمن المدى', outRange: 'خارج المدى',
    beans: 'البن هذا الشهر', g: 'غ', bags: 'كيس',
    streak: 'السلسلة', daysRow: 'أيام متتالية', bestRun: 'الأفضل',
  },
  en: {
    heatmap: 'Brew map · last 6 months', less: 'Less', more: 'More', cupsMonth: 'cups this month', longest: 'longest streak (days)',
    days: ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'], week: 'Week', cups: 'cups', cup: 'cup',
    hours: 'Brew times', peak: 'Peak', am: 'am', pm: 'pm', before10: 'of your brews before 10 am', brews: 'brews',
    need5: 'Needs at least 5 brews',
    consistency: 'Recipe consistency · brew time', last30: 'Last 30 brews', sec: 's', needRecipe: 'Shows after 5 completed brews of a recipe',
    median: 'Median', target: 'Target',
    share: 'Recipe share · this month', others: 'Others',
    water: 'Water per week', refills: 'tank refills this week', weeksAgo: '8 weeks ago', thisWeek: 'This week', litre: 'L',
    grade: 'Rating vs grind size', best: 'Best', rateToSee: 'Rate your brews with stars to see this',
    cold: 'Cold vs weather', coldSub: '% cold brews / week', per5: (n) => `Every +5° → ${n > 0 ? '+' : ''}${n}% cold`,
    tempNote: 'numbers = week’s mean temperature', coldPct: 'cold',
    cost: 'Cost per cup', sar: 'SAR', vsLast: 'vs last month', addPrice: 'Add bag price',
    ratio: 'Actual ratio', inRange: 'In range', outRange: 'Out of range',
    beans: 'Beans this month', g: 'g', bags: 'bags',
    streak: 'Streak', daysRow: 'days in a row', bestRun: 'Best',
  },
};
const tx = (lang) => TX[lang] || TX.en;

const N = ({ children, size, color, style }) => (
  <span className="an-num" dir="ltr" style={{ fontSize: size, color, ...style }}>{children}</span>
);

function hourName(h, T, lang) {
  if (lang !== 'ar') return `${h}:00`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? T.am : T.pm}`;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/* Tooltip shared by every chart: any element with data-tip shows it on hover, or on tap. */
function useTip() {
  const [tip, setTip] = useState(null);
  const show = useCallback((e) => {
    const el = e.target.closest?.('[data-tip]');
    const card = e.currentTarget;
    if (!el) { if (e.type === 'click') setTip(null); return; }
    const r = el.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    setTip({ text: el.getAttribute('data-tip'), x: r.left + r.width / 2 - c.left, y: r.top - c.top });
  }, []);
  const hide = useCallback((e) => { if (e.pointerType === 'mouse') setTip(null); }, []);
  const props = { onPointerOver: show, onClick: show, onPointerLeave: hide };
  const bubble = tip && <span className="an-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</span>;
  return [props, bubble];
}

function Card({ children, title, badge, badgeKind, aside }) {
  const [tipProps, bubble] = useTip();
  return (
    <div className="an-card" {...tipProps}>
      <div className="an-head">
        <span className="an-title">{title}</span>
        {badge != null && <span className={`an-badge ${badgeKind || ''}`}>{badge}</span>}
        {aside}
      </div>
      {children}
      {bubble}
    </div>
  );
}

function EmptyNote({ text }) {
  return <div className="an-empty"><div className="an-skel" /><span>{text}</span></div>;
}

/* 1 ── heatmap (L 8×2) */
export function Heatmap({ a, lang }) {
  const T = tx(lang);
  const h = a.heatmap;
  return (
    <Card title={T.heatmap} aside={(
      <span className="an-legend">{T.less}{[0, 1, 2, 3, 4].map((b) => <i key={b} className={`hm b${b}`} />)}{T.more}</span>
    )}>
      <div className="an-heat">
        <div className="an-heat-side">
          <div><N size="var(--an-big)">{h.cupsThisMonth}</N><span className="an-sub">{T.cupsMonth}</span></div>
          <div><N size="var(--an-mid)">{h.longestStreak}</N><span className="an-sub">{T.longest}</span></div>
        </div>
        <div className="an-heat-grid" dir="ltr">
          {h.weeks.map((w, wi) => (
            <div key={w.start} className="an-heat-col">
              {w.days.map((d, di) => d
                ? <i key={di} className={`hm b${d.bucket}`} data-tip={`${T.week} ${wi + 1} · ${d.date} · ${d.n} ${d.n === 1 ? T.cup : T.cups}`} />
                : <i key={di} className="hm future" />)}
            </div>
          ))}
          <div className="an-heat-days">{T.days.map((d) => <span key={d}>{d}</span>)}</div>
        </div>
      </div>
    </Card>
  );
}

/* 2 ── hours (M 4×2) */
export function Hours({ a, lang }) {
  const T = tx(lang);
  const h = a.hours;
  if (h.empty) return <Card title={T.hours}><EmptyNote text={T.need5} /></Card>;
  const rows = 8;
  return (
    <Card title={T.hours} badge={`${T.peak} ${hourName(h.peakHour, T, lang)}`} badgeKind="acc">
      <div className="an-hours" dir="ltr">
        {h.counts.map((n, hr) => {
          const lit = h.max ? Math.round((n / h.max) * rows) : 0;
          return (
            <div key={hr} className={`an-hcol${hr === h.peakHour ? ' peak' : ''}`} data-tip={`${hr}:00 · ${n} ${T.brews}`}>
              {Array.from({ length: rows }, (_, i) => <i key={i} className={rows - i <= lit ? 'on' : ''} />)}
            </div>
          );
        })}
      </div>
      <div className="an-axis" dir="ltr"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      <span className="an-foot"><N>{h.pctBefore10}%</N> {T.before10}</span>
    </Card>
  );
}

/* 3 ── consistency (M 4×2) */
export function Consistency({ a, lang }) {
  const T = tx(lang);
  const c = a.consistency;
  if (c.empty) return <Card title={T.consistency}><EmptyNote text={T.needRecipe} /></Card>;
  const [lo, hi] = c.axis;
  const span = Math.max(1, hi - lo);
  const pos = (s) => `${((s - lo) / span) * 100}%`;
  const ticks = [lo, lo + span / 2, hi];
  return (
    <Card title={T.consistency} badge={T.last30}>
      <div className="an-cons">
        {c.rows.map((r) => (
          <div key={r.recipe} className="an-cons-row">
            <div className="an-cons-label"><span className="an-strong" dir="auto">{r.recipe}</span><span className="an-sub" dir="ltr">±{r.iqrHalf} {T.sec}</span></div>
            <div className="an-strip" dir="ltr">
              {r.band && <span className="an-band" style={{ left: pos(r.band[0]), width: `${(20 / span) * 100}%` }} data-tip={`${T.target} ${mmss(r.planned)} ±10 ${T.sec}`} />}
              {r.durations.map((d, i) => <i key={i} style={{ left: pos(d), top: `${30 + ((i * 37) % 40)}%` }} data-tip={`${mmss(d)}`} />)}
              <span className="an-median" style={{ left: pos(r.median) }} data-tip={`${T.median} ${mmss(r.median)}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="an-axis" dir="ltr">{ticks.map((s) => <span key={s}>{mmss(s)}</span>)}</div>
    </Card>
  );
}

/* 4 ── recipeShare (M 4×2): 10×10 waffle, 1 dot = 1% */
export function RecipeShare({ a, lang }) {
  const T = tx(lang);
  const s = a.recipeShare;
  if (s.empty) return <Card title={T.share}><EmptyNote text={T.need5} /></Card>;
  const dots = [];
  s.slots.forEach((slot, i) => { for (let k = 0; k < slot.pct; k++) dots.push(i); });
  const name = (slot) => (slot.others ? T.others : slot.recipe);
  return (
    <Card title={T.share}>
      <div className="an-share">
        <ul className="an-legend-list">
          {s.slots.map((slot, i) => (
            <li key={slot.recipe}>
              <i style={{ background: CATEGORICAL[Math.min(i, 3)] }} />
              <span className="ellipsis" dir="auto">{name(slot)}</span>
              <N>{slot.pct}%</N>
            </li>
          ))}
        </ul>
        <div className="an-waffle" dir="ltr">
          {dots.map((i, k) => <i key={k} style={{ background: CATEGORICAL[Math.min(i, 3)] }} data-tip={`${name(s.slots[i])} · ${s.slots[i].pct}%`} />)}
        </div>
      </div>
    </Card>
  );
}

/* 5 ── waterWeekly (M 4×2) */
export function WaterWeekly({ a, lang }) {
  const T = tx(lang);
  const w = a.waterWeekly;
  const max = Math.max(1, ...w.weeks.map((x) => x.ml));
  return (
    <Card title={T.water} aside={<span className="an-sub">{w.refillsThisWeek} {T.refills}</span>}>
      <div className="an-bars" dir="ltr">
        {w.weeks.map((x) => (
          <div key={x.start} className={`an-bar water${x.current ? ' current' : ''}`} data-tip={`${x.start} · ${(x.ml / 1000).toFixed(1)} ${T.litre}`}>
            {x.current && <N>{(x.ml / 1000).toFixed(1)}</N>}
            <div className="an-fill" style={{ height: `${Math.max(2, (x.ml / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="an-axis two" dir="ltr"><span>{T.weeksAgo}</span><span>{T.thisWeek}</span></div>
    </Card>
  );
}

/* 6 ── gradeRating (M 4×2) */
export function GradeRating({ a, lang }) {
  const T = tx(lang);
  const g = a.gradeRating;
  if (g.empty) return <Card title={T.grade}><EmptyNote text={T.rateToSee} /></Card>;
  const xs = g.points.map((p) => p.grind);
  const lo = Math.min(...xs, g.best ? g.best.from : Infinity) - 1;
  const hi = Math.max(...xs, g.best ? g.best.to : -Infinity) + 1;
  const px = (v) => `${((v - lo) / Math.max(1, hi - lo)) * 100}%`;
  const py = (r) => `${100 - ((r - 1) / 4) * 100}%`;
  return (
    <Card title={T.grade} badge={g.best ? `${T.best} #${g.best.from}–${g.best.to}` : null} badgeKind="ok">
      <div className="an-scatter" dir="ltr">
        {g.best && <span className="an-best" style={{ left: px(g.best.from - 0.5), width: `calc(${px(g.best.to + 0.5)} - ${px(g.best.from - 0.5)})` }} />}
        {g.points.map((p, i) => <i key={i} style={{ left: px(p.grind), top: py(p.rating) }} data-tip={`#${p.grind} · ${p.rating}★`} />)}
        <span className="an-y top">★5</span><span className="an-y bottom">★1</span>
      </div>
      <div className="an-axis" dir="ltr"><span>#{Math.round(lo + 1)}</span><span>#{Math.round((lo + hi) / 2)}</span><span>#{Math.round(hi - 1)}</span></div>
    </Card>
  );
}

/* 7 ── coldWeather (M 4×2) */
export function ColdWeather({ a, lang }) {
  const T = tx(lang);
  const c = a.coldWeather;
  if (c.empty) return <Card title={T.cold} aside={<span className="an-sub">{T.coldSub}</span>}><EmptyNote text="" /></Card>;
  return (
    <Card title={T.cold} aside={<span className="an-sub">{T.coldSub}</span>}>
      <div className="an-bars" dir="ltr">
        {c.weeks.map((x) => (
          <div key={x.start} className="an-bar cold" data-tip={`${x.start} · ${x.pctCold ?? 0}% ${T.coldPct}${x.meanTemp != null ? ` · ${x.meanTemp}°` : ''}`}>
            <div className="an-fill" style={{ height: `${Math.max(2, x.pctCold || 0)}%` }} />
            <em>{x.meanTemp != null ? `${Math.round(x.meanTemp)}°` : '–'}</em>
          </div>
        ))}
      </div>
      <span className="an-foot">{c.per5Deg != null ? `${T.per5(c.per5Deg)} · ` : ''}{T.tempNote}</span>
    </Card>
  );
}

/* 8–11 ── small tiles (S 2×1) */
export function CostPerCup({ a, lang, onAddBag }) {
  const T = tx(lang);
  const c = a.costPerCup;
  if (c.empty) {
    return (
      <div className="an-card one">
        <span className="an-title">{T.cost}</span>
        <button className="wg-btn sm" onClick={onAddBag}>{T.addPrice}</button>
      </div>
    );
  }
  const d = c.delta;
  return (
    <div className="an-card one">
      <span className="an-title">{T.cost}</span>
      <div className="an-line"><N size="var(--an-tile)">{c.sar != null ? c.sar.toFixed(1) : '–'}</N><span className="an-sub">{T.sar}</span></div>
      {d != null && d !== 0 && (
        <span className={`an-delta ${d < 0 ? 'down' : 'up'}`}>{d < 0 ? '▼' : '▲'} <span dir="ltr">{Math.abs(d).toFixed(1)}</span> {T.vsLast}</span>
      )}
    </div>
  );
}

export function Ratio({ a, lang }) {
  const T = tx(lang);
  const r = a.ratio;
  return (
    <div className="an-card one">
      <span className="an-title">{T.ratio}</span>
      <N size="var(--an-tile)">{r.ratio != null ? `1:${r.ratio}` : '–'}</N>
      {r.target != null && (
        <span className="an-sub">{T.target} <span dir="ltr">1:{r.target}</span> · <span className={r.inRange ? 'an-ok' : 'an-warn'}>{r.inRange ? T.inRange : T.outRange}</span></span>
      )}
    </div>
  );
}

export function BeansUsed({ a, lang }) {
  const T = tx(lang);
  const b = a.beansUsed;
  return (
    <div className="an-card one">
      <span className="an-title">{T.beans}</span>
      <div className="an-line"><N size="var(--an-tile)">{Math.round(b.grams)}</N><span className="an-sub">{T.g}</span></div>
      {b.bags != null && <span className="an-sub">≈ <span dir="ltr">{b.bags}</span> {T.bags}</span>}
    </div>
  );
}

export function Streak({ a, lang }) {
  const T = tx(lang);
  const s = a.streak;
  return (
    <div className="an-card one">
      <span className="an-title">{T.streak}</span>
      <div className="an-line"><N size="var(--an-tile)" color="var(--accent)">{s.current}</N><span className="an-sub">{T.daysRow}</span></div>
      <span className="an-sub">{T.bestRun} <span dir="ltr">{s.best}</span></span>
    </div>
  );
}

export const ANALYTICS_KINDS = {
  heatmap: Heatmap, hours: Hours, consistency: Consistency, recipeShare: RecipeShare, waterWeekly: WaterWeekly,
  gradeRating: GradeRating, coldWeather: ColdWeather, costPerCup: CostPerCup, ratio: Ratio, beansUsed: BeansUsed, streak: Streak,
};

// Renders one analytics widget; a loading skeleton until the first numbers arrive.
export default function AnalyticsWidget({ kind, a, lang, onAddBag }) {
  const C = ANALYTICS_KINDS[kind];
  if (!C) return null;
  if (!a) return <div className="an-card"><div className="an-skel tall" /></div>;
  return <C a={a} lang={lang} onAddBag={onAddBag} />;
}
