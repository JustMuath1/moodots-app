import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { t } from '../utils/i18n';
import { WEEK } from '../utils/days';
import { TimeWheel, DatePicker } from './Pickers';

export default function ScheduleSheet({ schedule, recipes, lang, onClose, onSave, onDelete }) {
  const [time, setTime] = useState(schedule.time || '07:00');
  const [days, setDays] = useState(schedule.days || [6, 0, 1, 2, 3]);
  const [recipeName, setRecipeName] = useState(schedule.recipe_name || schedule.recipe?.name || recipes[0]?.name || '');
  const [enabled, setEnabled] = useState(schedule.enabled !== false);
  const [repeat, setRepeat] = useState(schedule.date ? 'once' : 'weekly'); // weekly days, or one date
  const [date, setDate] = useState(schedule.date || (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })());

  const overlayRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(sheetRef.current, { y: '100%' }, { y: 0, duration: 0.4, ease: 'power3.out' });
  }, []);

  const handleClose = () => {
    gsap.to(sheetRef.current, { y: '100%', duration: 0.3, ease: 'power2.in' });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.25, onComplete: onClose });
  };

  const toggleDay = (d) => {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b));
  };

  const handleSave = () => {
    // server.py brews sched.recipe (the full recipe object), not a reference
    const r = recipes.find((x) => x.name === recipeName) || schedule.recipe;
    onSave({
      ...(schedule.id ? { id: schedule.id } : {}),
      name: r?.name || 'My Brew',
      time,
      days,
      date: repeat === 'once' ? date : null,
      recipe_name: r?.name || '',
      recipe: r || null,
      enabled,
    });
  };

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '15px',
    fontFamily: 'inherit',
    width: '100%',
  };

  const btnBase = {
    height: '48px',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 700,
    border: 'none',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div className="sheet-overlay" ref={overlayRef} onClick={handleClose}>
      <div className="sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{t('schedule', lang)}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="pk-label">{t('time', lang)}</label>
            <TimeWheel value={time} onChange={setTime} lang={lang} />
          </div>

          <div>
            <div className="pk-seg" role="group" aria-label={t('repeat', lang)}>
              <button type="button" className={repeat === 'weekly' ? 'on' : ''} onClick={() => setRepeat('weekly')}>{t('repeatWeekly', lang)}</button>
              <button type="button" className={repeat === 'once' ? 'on' : ''} onClick={() => setRepeat('once')}>{t('repeatOnce', lang)}</button>
            </div>
          </div>

          {repeat === 'weekly' ? (
            <div>
              <label className="pk-label">{t('days', lang)}</label>
              <div className="pk-days">
                {WEEK.map(({ key: dk, value: i }) => (
                  <button key={dk} type="button" onClick={() => toggleDay(i)} className={days.includes(i) ? 'on' : ''} aria-pressed={days.includes(i)}>
                    {t(dk, lang)}
                  </button>
                ))}
              </div>
              <div className="pk-presets">
                <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>{t('everyDay', lang)}</button>
                <button type="button" onClick={() => setDays([6, 0, 1, 2, 3])}>{t('workdays', lang)}</button>
                <button type="button" onClick={() => setDays([4, 5])}>{t('weekend', lang)}</button>
              </div>
            </div>
          ) : (
            <div>
              <label className="pk-label">{t('date', lang)}</label>
              <DatePicker value={date} onChange={setDate} lang={lang} />
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              {t('recipe', lang)}
            </label>
            <select
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              style={inputStyle}
            >
              {recipes.map((r) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--accent)' }}>{t('wakeBefore', lang)}</div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div
              onClick={(e) => { e.preventDefault(); setEnabled(!enabled); }}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                background: enabled ? 'var(--accent)' : 'var(--surface-2)',
                position: 'relative',
                transition: 'background .2s',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: '2px',
                left: enabled ? '22px' : '2px',
                transition: 'left .2s',
              }} />
            </div>
            <span style={{ fontSize: '14px', color: 'var(--text)' }}>{t('enabled', lang)}</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button style={{ ...btnBase, flex: 1, background: 'var(--accent)', color: 'var(--on-accent)' }} onClick={handleSave}>
            {t('save', lang)}
          </button>
          {schedule.id && (
            <button style={{ ...btnBase, background: 'var(--stop-bg)', color: 'var(--stop-fg)' }} onClick={() => onDelete(schedule.id)}>
              {t('delete', lang)}
            </button>
          )}
          <button style={{ ...btnBase, background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--muted-2)' }} onClick={handleClose}>
            {t('cancel', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
