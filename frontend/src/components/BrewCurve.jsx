import React, { useMemo, useState } from 'react';

// Brew curve (AddonIdeas.dc.html, idea 2): water poured against time as a dot-matrix line.
// This brew = accent with the area under it shaded; best-rated brew of the same recipe = blue-grey.
// Time runs left → right (dir="ltr"). Hover/tap a column for its time and water.
const COLS = 60;

const TX = {
  ar: { title: 'منحنى التحضير', now: 'الآن', best: 'أفضل تحضير', slower: 'أبطأ بـ', faster: 'أسرع بـ', same: 'مثل أفضل تحضير', sec: 'ث', ml: 'مل', empty: 'يظهر المنحنى أثناء التحضير', last: 'آخر تحضير' },
  en: { title: 'Brew curve', now: 'Now', best: 'Best brew', slower: 'Slower by', faster: 'Faster by', same: 'Same as best', sec: 's', ml: 'ml', empty: 'The curve draws while you brew', last: 'Last brew' },
};

// water at time t on a curve of [t, ml] samples (last value at or before t)
function at(curve, t) {
  let v = 0;
  for (const [ts, ml] of curve) { if (ts > t) break; v = ml; }
  return v;
}
// first time a curve reaches `ml`
function timeTo(curve, ml) {
  for (const [ts, v] of curve) if (v >= ml - 0.5) return ts;
  return null;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function BrewCurve({ lang, live, best, total, nowLabel, compact }) {
  const ROWS = compact ? 6 : 12;
  const T = TX[lang] || TX.en;
  const [tip, setTip] = useState(null);
  const now = live && live.length > 1 ? live : null;
  const ref = best?.curve?.length > 1 ? best.curve : null;

  const grid = useMemo(() => {
    if (!now && !ref) return null;
    const tEnd = Math.max(now ? now[now.length - 1][0] : 0, ref ? ref[ref.length - 1][0] : 0, 60);
    const tMax = Math.ceil(tEnd / 60) * 60; // whole minutes on the axis
    const yMax = Math.max(total || 0, ...(now || []).map((p) => p[1]), ...(ref || []).map((p) => p[1]), 1);
    const nowEnd = now ? now[now.length - 1][0] : -1;
    const row = (ml) => Math.min(ROWS - 1, Math.round((ml / yMax) * (ROWS - 1)));
    const cols = [];
    for (let c = 0; c < COLS; c++) {
      const t = ((c + 0.5) / COLS) * tMax;
      const n = now && t <= nowEnd ? at(now, t) : null;
      const b = ref ? at(ref, t) : null;
      cols.push({ t, n, b, nr: n == null ? -1 : row(n), br: b == null ? -1 : row(b) });
    }
    let delta = null;
    if (now && ref) {
      const ml = now[now.length - 1][1];
      const tn = timeTo(now, ml);
      const tb = timeTo(ref, ml);
      if (ml > 5 && tn != null && tb != null) delta = Math.round(tn - tb);
    }
    return { cols, tMax, delta };
  }, [now, ref, total, ROWS]);

  const badge = grid?.delta == null ? null
    : Math.abs(grid.delta) < 3 ? T.same
    : `${grid.delta > 0 ? T.slower : T.faster} ${Math.abs(grid.delta)} ${T.sec}`;

  return (
    <div className={`bc${compact ? ' compact' : ''}`}>
      <div className="bc-head">
        <span className="bc-key"><i className="now" />{nowLabel || T.now}</span>
        {ref && <span className="bc-key"><i className="best" />{T.best} {'★'.repeat(best.rating || 0)}</span>}
        {badge && <span className={`bc-badge${grid.delta > 2 ? ' slow' : ''}`}>{badge}</span>}
      </div>
      {grid ? (
        <>
          <div className="bc-grid" dir="ltr"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, '--bc-rows': ROWS }}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setTip(null)}>
            {grid.cols.map((col, c) => (
              <div key={c} className="bc-col" onPointerEnter={() => setTip(c)} onClick={() => setTip(c)}>
                {Array.from({ length: ROWS }, (_, r) => {
                  const y = ROWS - 1 - r; // bottom row = 0
                  const cls = y === col.nr ? 'now' : y === col.br ? 'best' : (col.nr >= 0 && y < col.nr) ? 'area' : '';
                  return <i key={r} className={cls} />;
                })}
              </div>
            ))}
            {tip != null && (
              <span className="bc-tip" style={{ left: `${((tip + 0.5) / COLS) * 100}%` }}>
                {mmss(grid.cols[tip].t)}
                {grid.cols[tip].n != null && <> · {T.now} {Math.round(grid.cols[tip].n)} {T.ml}</>}
                {grid.cols[tip].b != null && <> · {T.best} {Math.round(grid.cols[tip].b)} {T.ml}</>}
              </span>
            )}
          </div>
          {!compact && <div className="bc-axis" dir="ltr">
            {Array.from({ length: grid.tMax / 60 + 1 }, (_, m) => <span key={m}>{m}:00</span>)}
          </div>}
        </>
      ) : <div className="bc-empty">{T.empty}</div>}
    </div>
  );
}

export { TX as CURVE_TX };
