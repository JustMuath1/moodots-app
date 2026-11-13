import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { t } from '../utils/i18n';
import { WEEK } from '../utils/days';

export default function ScheduleList({ schedules, lang, onEdit, onAdd }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const cards = listRef.current.querySelectorAll('.schedule-card');
    gsap.fromTo(cards, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' });
  }, [schedules.length]);

  return (
    <div className="schedule-list" ref={listRef}>
      {schedules.map((s) => {
        const days = s.days || [];
        const dayLabels = days.length === 7
          ? WEEK.map((d) => t(d.key, lang)).join(' · ')
          : WEEK.filter((d) => days.includes(d.value)).map((d) => t(d.key, lang)).join(' · ');
        const onceLabel = s.date ? new Date(`${s.date}T00:00`).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
        const enabled = s.enabled !== false;
        return (
          <button key={s.id} className={`schedule-card${enabled ? '' : ' off'}`} onClick={() => onEdit(s)}>
            <div className="schedule-main">
              <div className="schedule-time" dir="ltr">{s.time || '--:--'}</div>
              <div className="schedule-days">{s.date ? `${t('once', lang)} · ${onceLabel}` : (dayLabels || '—')}</div>
              {enabled && (
                <div className="schedule-wake">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2M19 12h2M17 7l1.4-1.4M7 16a5 5 0 0 1 10 0M3 20h18" />
                  </svg>
                  {t('wakeBefore', lang)}
                </div>
              )}
            </div>
            <div className="schedule-recipe" dir="auto">{s.recipe_name || s.recipe?.name || '—'}</div>
          </button>
        );
      })}
      <button className="schedule-add-row" onClick={onAdd}>{t('addSchedule', lang)}</button>
    </div>
  );
}
