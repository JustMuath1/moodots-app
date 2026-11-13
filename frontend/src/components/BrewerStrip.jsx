import React from 'react';
import { t } from '../utils/i18n';
import Skeleton from './Skeleton';

export default function BrewerStrip({ lang, pouring, grinding, transfer, heating, waiting, waitLeft, paused, hot, temp, volume, flow, loading }) {
  const status = pouring ? t('pouringWater', lang)
    : paused ? t('paused', lang)
    : waiting ? `${t('waiting', lang)}${waitLeft > 0 ? ` · ${waitLeft} ${t('secShort', lang)}` : ''}`
    : transfer ? t('receivingGrounds', lang)
    : heating ? `${t('heatingWater', lang)}…`
    : grinding ? t('heatingWater', lang)
    : t('idle', lang);

  const dropClass = (extra) => pouring ? `xb-drop${extra}` : 'xb-still';

  return (
    <section className={`strip-card${pouring ? ' pouring' : waiting ? ' waiting' : ''}`}>
      <div className="strip-row">
        <div className="drop-icon">
          <span className={`drop-shape ${dropClass('')}`} style={{ right: 1, top: 7 }} />
          <span className={`drop-shape ${dropClass(' xb-d2')}`} style={{ right: 9, top: 7 }} />
          <span className={`drop-shape ${dropClass(' xb-d3')}`} style={{ right: 17, top: 7 }} />
        </div>
        <div className="strip-info">
          <span className="strip-title">{t('brewer', lang)}</span>
          <span className="strip-status">{status}</span>
        </div>
        {loading ? <Skeleton className="skel-strip-3" /> : (
          <>
          <div className="strip-stat">
            <span className={`strip-val${hot ? ' hot' : ''}`} dir="ltr">{temp}</span>
            <span className="strip-label">{t('celsius', lang)}</span>
          </div>
          <div className="strip-stat">
            <span className="strip-val" dir="ltr">{volume}</span>
            <span className="strip-label">{t('ml', lang)}</span>
          </div>
          <div className="strip-stat">
            <span className="strip-val" dir="ltr">{flow}</span>
            <span className="strip-label">{t('mlMin', lang)}</span>
          </div>
          </>
        )}
      </div>
      <div className={`strip-bar${pouring ? ' xb-hot' : waiting || heating ? ' xb-wait' : ''}`} />
    </section>
  );
}
