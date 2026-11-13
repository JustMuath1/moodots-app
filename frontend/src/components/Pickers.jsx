import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';

// Time wheel (hours · minutes) and month calendar, in the dot-matrix style. Numbers use Doto, dir="ltr".

const ITEM = 44; // px per row in the wheel
const pad = (n) => String(n).padStart(2, '0');

function Wheel({ values, value, onChange, label }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const idx = Math.max(0, values.indexOf(value));

  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM) !== idx) el.scrollTo({ top: idx * ITEM });
  }, [idx]);

  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
      if (values[i] !== value) onChange(values[i]);
    }, 90);
  };
  const step = (d) => onChange(values[(idx + d + values.length) % values.length]);

  return (
    <div className="pk-wheel" role="listbox" aria-label={label} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); } if (e.key === 'ArrowDown') { e.preventDefault(); step(1); } }}>
      <div className="pk-wheel-scroll" ref={ref} onScroll={onScroll}>
        <div className="pk-wheel-pad" />
        {values.map((v) => (
          <button key={v} type="button" role="option" aria-selected={v === value} className={`pk-wheel-item${v === value ? ' on' : ''}`}
            onClick={() => onChange(v)}>{pad(v)}</button>
        ))}
        <div className="pk-wheel-pad" />
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function TimeWheel({ value, onChange, lang }) {
  const [h, m] = (value || '07:00').split(':').map(Number);
  const set = (hh, mm) => onChange(`${pad(hh)}:${pad(mm)}`);
  const ar = lang === 'ar';
  const period = h < 12 ? (ar ? 'صباحاً' : 'AM') : (ar ? 'مساءً' : 'PM');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return (
    <div className="pk-time">
      <div className="pk-time-wheels" dir="ltr">
        <Wheel values={HOURS} value={h} onChange={(v) => set(v, m)} label={ar ? 'الساعة' : 'Hour'} />
        <span className="pk-colon">:</span>
        <Wheel values={MINUTES} value={m} onChange={(v) => set(h, v)} label={ar ? 'الدقيقة' : 'Minute'} />
        <div className="pk-band" aria-hidden="true" />
      </div>
      <span className="pk-time-note"><span dir="ltr">{h12}:{pad(m)}</span> {period}</span>
    </div>
  );
}

// Month calendar. Weeks start on Saturday. Past days are disabled. Value is "YYYY-MM-DD" (local).
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, mo, d] = s.split('-').map(Number); return new Date(y, mo - 1, d); };

export function DatePicker({ value, onChange, lang }) {
  const ar = lang === 'ar';
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);
  const sel = value ? fromIso(value) : null;
  const [view, setView] = useState(() => { const b = sel || today; return new Date(b.getFullYear(), b.getMonth(), 1); });
  const loc = ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  const title = view.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const weekdays = ar ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'] : ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
  const lead = (view.getDay() + 1) % 7; // Saturday-first offset
  const daysIn = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  const canPrev = view > new Date(today.getFullYear(), today.getMonth(), 1);
  const move = useCallback((d) => setView((v) => new Date(v.getFullYear(), v.getMonth() + d, 1)), []);
  const hijri = sel ? sel.toLocaleDateString(ar ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const full = sel ? sel.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  return (
    <div className="pk-cal">
      <div className="pk-cal-head">
        <button type="button" className="pk-nav" onClick={() => move(ar ? 1 : -1)} disabled={ar ? false : !canPrev} aria-label={ar ? 'الشهر التالي' : 'Previous month'}>‹</button>
        <span className="pk-cal-title">{title}</span>
        <button type="button" className="pk-nav" onClick={() => move(ar ? -1 : 1)} disabled={ar ? !canPrev : false} aria-label={ar ? 'الشهر السابق' : 'Next month'}>›</button>
      </div>
      <div className="pk-cal-grid">
        {weekdays.map((w) => <span key={w} className="pk-wd">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const past = d < today;
          const on = sel && iso(d) === iso(sel);
          const isToday = iso(d) === iso(today);
          return (
            <button key={iso(d)} type="button" disabled={past} onClick={() => onChange(iso(d))}
              className={`pk-day${on ? ' on' : ''}${isToday ? ' today' : ''}`} aria-pressed={on} dir="ltr">{d.getDate()}</button>
          );
        })}
      </div>
      {sel && <span className="pk-cal-note">{full} · {hijri}</span>}
    </div>
  );
}
