import React from 'react';
import { t } from '../utils/i18n';
import Skeleton from './Skeleton';

export default function GrinderStrip({ lang, grinding, grindDone, grindSize, rpm, loading }) {
  const status = grinding ? t('grindingNow', lang) : grindDone ? t('grindDone', lang) : t('idle', lang);

  return (
    <section className={`strip-card${grinding ? ' grinding' : ''}`}>
      <div className="strip-row">
        <div className={`strip-icon${grinding ? ' xb-spin' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>
          </svg>
        </div>
        <div className="strip-info">
          <span className="strip-title">{t('grinder', lang)}</span>
          <span className="strip-status">{status}</span>
        </div>
        {loading ? <Skeleton className="skel-strip-2" /> : (
          <>
          <div className="strip-stat">
            <span className="strip-val" dir="ltr">{grindSize}</span>
            <span className="strip-label">{t('degree', lang)}</span>
          </div>
          <div className="strip-stat">
            <span className="strip-val" dir="ltr">{rpm}</span>
            <span className="strip-label">{t('rpmUnit', lang)}</span>
          </div>
          </>
        )}
      </div>
      <div className={`strip-bar${grinding ? ' xb-bar' : ''}`} />
    </section>
  );
}
