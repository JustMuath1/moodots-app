import React, { useEffect, useRef, useState } from 'react';
import { t } from '../utils/i18n';
import Logo from './Logo';
import { isHot } from '../services/addons';
import CityScene, { CITY_VARS } from './CityScene';
import { standbyLocked } from '../utils/pro';
import { LockMark } from './ProSheet';

const CUP = [
  '...............',
  '...............',
  '...............',
  '...............',
  '...............',
  '...............',
  '..CCCCCCCCCC...',
  '..CccccccccCHH.',
  '..CccccccccC..H',
  '..CccccccccC..H',
  '..CccccccccCHH.',
  '...CccccccC....',
  '....CCCCCC.....',
  '...............',
  '.BBBBBBBBBBBB..',
];
const HEART_BIG = [
  '...............',
  '...............',
  '...............',
  '...XXX...XXX...',
  '..XXXXX.XXXXX..',
  '.XXXXXXXXXXXXX.',
  '.XXXXXXXXXXXXX.',
  '..XXXXXXXXXXX..',
  '...XXXXXXXXX...',
  '....XXXXXXX....',
  '.....XXXXX.....',
  '......XXX......',
  '.......X.......',
  '...............',
  '...............',
];
const HEART_SMALL = [
  '...............',
  '...............',
  '...............',
  '...............',
  '...............',
  '.....X...X.....',
  '....XXX.XXX....',
  '....XXXXXXX....',
  '.....XXXXX.....',
  '......XXX......',
  '.......X.......',
  '...............',
  '...............',
  '...............',
  '...............',
];

export const STANDBY_MODES = ['cup', 'heart', 'dot', 'dalla', 'palm', 'riyadh', 'dammam', 'baha'];
const MODE_KEY = { cup: 'standbyCup', heart: 'standbyHeart', dot: 'standbyDot', dalla: 'standbyDalla', palm: 'standbyPalm', riyadh: 'standbyRiyadh', dammam: 'standbyDammam', baha: 'standbyBaha' };
const CITIES = ['dalla', 'palm', 'riyadh', 'dammam', 'baha'];
// the standby scene that belongs to a theme
export const THEME_STANDBY = { saudi: 'dalla', riyadh: 'riyadh', dammam: 'dammam', baha: 'baha' };
const OFF = { backgroundColor: '#2A2522' };

function lit(a) {
  return {
    backgroundColor: `rgba(255, 246, 234, ${a})`,
    boxShadow: `0 0 ${Math.round(12 * a)}px rgba(255, 236, 214, ${Math.min(1, a * 0.9)})`,
  };
}

// heart rhythm: big-big-small over 10 frames
const beat = (f) => { const p = f % 10; return p === 0 || p === 1 || p === 3; };

function buildDots(mode, f) {
  const out = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      let st = OFF;
      if (mode === 'cup') {
        const ch = CUP[r][c];
        if (ch === 'C' || ch === 'H') st = lit(1);
        else if (ch === 'B') st = lit(0.6);
        else if (ch === 'c') st = lit(r === 7 ? ((c + Math.floor(f / 2)) % 4 === 0 ? 0.95 : 0.7) : 0.45);
        else if (r <= 5) {
          [4, 7, 10].forEach((base, k) => {
            const tt = f + k * 3;
            const sway = [0, 1, 0, -1][Math.floor((tt + (5 - r) * 2) / 3) % 4];
            const rising = (r + Math.floor(tt / 1.5)) % 6;
            if (c === base + sway && rising < 4) st = lit(Math.min(1, 0.5 + 0.1 * r));
          });
        }
      } else if (mode === 'heart') {
        const big = beat(f);
        if ((big ? HEART_BIG : HEART_SMALL)[r][c] === 'X') st = lit(big ? 1 : 0.9);
      } else {
        const d = Math.hypot(r - 7, c - 7);
        const R = (f % 12) * 0.75;
        const R2 = ((f + 6) % 12) * 0.75;
        if (d < 0.5) st = lit(1);
        else if (Math.abs(d - R) < 0.55) st = lit(Math.max(0.4, 1 - R / 12));
        else if (Math.abs(d - R2) < 0.55) st = lit(Math.max(0.4, 1 - R2 / 12));
      }
      out.push(st);
    }
  }
  return out;
}

const LOCALES = {
  ar: { greg: 'ar-SA-u-ca-gregory-nu-latn', hijri: 'ar-SA-u-ca-islamic-umalqura-nu-latn' },
  en: { greg: 'en-GB', hijri: 'en-GB-u-ca-islamic-umalqura' },
};

// What the standby screen shows; each item can be turned on/off from the customise panel
export const STANDBY_ITEMS = ['dates', 'nextBrew', 'weather', 'verse', 'styles'];
const ITEM_LABEL = {
  ar: { dates: 'التاريخ الهجري والميلادي', nextBrew: 'التحضير التالي', weather: 'الطقس', verse: 'آية ودعاء', styles: 'أزرار الأنماط' },
  en: { dates: 'Hijri and Gregorian dates', nextBrew: 'Next brew', weather: 'Weather', verse: 'Verse & duaa', styles: 'Style buttons' },
};
const SB_TXT = {
  ar: { customise: 'تخصيص شاشة الاستعداد', customiseShort: 'تخصيص', show: 'ما يظهر في شاشة الاستعداد', style: 'النمط', done: 'تم', nextBrew: 'التحضير التالي' },
  en: { customise: 'Customise standby', customiseShort: 'Customise', show: 'Shown on the standby screen', style: 'Style', done: 'Done', nextBrew: 'Next brew' },
};

export default function Standby({ lang, mode, pro, onModeChange, onExit, weather, verse, nextSchedule, items = {}, onItems }) {
  const [panel, setPanel] = useState(false);
  const L = lang === 'ar' ? 'ar' : 'en';
  const S = SB_TXT[L];
  const on = (k) => items[k] !== false;
  const stop = (e) => e.stopPropagation();
  const [frame, setFrame] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const rootRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => { setFrame((f) => f + 1); setNow(new Date()); }, 150);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { setFrame(0); }, [mode]);
  useEffect(() => { rootRef.current?.focus(); }, []);

  const loc = LOCALES[lang] || LOCALES.en;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const dateStr = now.toLocaleDateString(loc.greg, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hijri = now.toLocaleDateString(loc.hijri, { day: 'numeric', month: 'long', year: 'numeric' });
  const isCity = CITIES.includes(mode);
  const big = mode === 'heart' && beat(frame);
  const dots = isCity ? [] : buildDots(mode, frame);
  const cityStyle = isCity
    ? Object.fromEntries(Object.entries(CITY_VARS[mode]).map(([k, v]) => [`--c-${k}`, v]))
    : undefined;
  const greeting = !isCity ? ''
    : mode === 'dalla' || mode === 'palm'
      ? `${t(now.getHours() < 12 ? 'goodMorning' : 'goodEvening', lang)} · ${t(mode === 'dalla' ? 'dallaGreeting' : 'palmGreeting', lang)}`
    : `${t(now.getHours() < 12 ? 'goodMorningFrom' : 'goodEveningFrom', lang)} ${t(MODE_KEY[mode], lang)}`;

  return (
    <div
      ref={rootRef}
      className={`standby${isCity ? ' city' : ''}`}
      style={cityStyle}
      role="button"
      tabIndex={-1}
      aria-label={t('standbyReturn', lang)}
      // click (not pointerdown) so the tap that wakes the screen can't land on a control underneath
      onClick={onExit}
      onKeyDown={onExit}
    >
      {isCity && <div className="sb-band" aria-hidden="true" />}
      {weather && on('weather') && (
        <span className="sb-weather" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <b dir="ltr" className={isHot(weather.temp) ? 'hot' : ''}>{weather.temp}°</b>
          {weather.city[lang === 'ar' ? 'ar' : 'en']} · {weather.cond[lang === 'ar' ? 'ar' : 'en']}
        </span>
      )}
      {isCity ? (
        <div className="sb-city">
          <CityScene city={mode} frame={frame} label={t(MODE_KEY[mode], lang)} />
          <div className="sb-clock">
            <div className="sb-greeting">{greeting}</div>
            <div className="sb-time" dir="ltr">{hh}<span className="xb-blink">:</span>{mm}</div>
            {on('dates') && <div className="sb-date">{hijri}</div>}
            {on('dates') && <div className="sb-hijri">{dateStr}</div>}
            {verse && on('verse') && <p className="sb-verse">{verse.t}</p>}
            {nextSchedule && on('nextBrew') && <div className="sb-next">{S.nextBrew} · <b dir="ltr">{nextSchedule.time}</b> · <span dir="auto">{nextSchedule.recipe}</span></div>}
          </div>
        </div>
      ) : (
        <>
          <div className="sb-art">
            <div
              className={`sb-halo${mode === 'heart' ? ' beat' : ' sb-breath'}`}
              style={mode === 'heart' ? { transform: `scale(${big ? 1.12 : 0.9})`, opacity: big ? 1 : 0.6 } : undefined}
            />
            <div className="sb-grid" role="img" aria-label={t(MODE_KEY[mode], lang)}>
              {dots.map((st, i) => <div key={i} className="sb-dot" style={st} />)}
            </div>
          </div>

          <div className="sb-clock">
            <div className="sb-time" dir="ltr">{hh}<span className="xb-blink">:</span>{mm}</div>
            {on('dates') && <div className="sb-date">{dateStr}</div>}
            {on('dates') && <div className="sb-hijri">{hijri}</div>}
            {verse && on('verse') && <p className="sb-verse">{verse.t}</p>}
            {nextSchedule && on('nextBrew') && <div className="sb-next">{S.nextBrew} · <b dir="ltr">{nextSchedule.time}</b> · <span dir="auto">{nextSchedule.recipe}</span></div>}
          </div>
        </>
      )}


      {panel && (
        <div className="sb-sheet-overlay" onClick={(e) => { e.stopPropagation(); setPanel(false); }}>
          <div className="sb-sheet" onClick={stop} onKeyDown={stop} dir={L === 'ar' ? 'rtl' : 'ltr'} role="dialog" aria-label={S.customise}>
            <div className="sb-sheet-head">
              <span className="sb-sheet-title">{S.customise}</span>
              <button className="sb-sheet-done" onClick={() => setPanel(false)}>{S.done}</button>
            </div>
            <span className="sb-panel-sub">{S.style}</span>
            <div className="sb-sheet-modes">
              {STANDBY_MODES.map((k) => (
                <button key={k} className={`sb-sheet-mode${mode === k ? ' on' : ''}`} onClick={() => onModeChange(k)} aria-pressed={mode === k}>{t(MODE_KEY[k], lang)}{standbyLocked(k, pro) && <LockMark size={11} />}</button>
              ))}
            </div>
            <span className="sb-panel-sub">{S.show}</span>
            <div className="sb-sheet-list">
              {STANDBY_ITEMS.map((k) => (
                <button key={k} className="sb-toggle" onClick={() => onItems?.({ ...items, [k]: !on(k) })} aria-pressed={on(k)}>
                  <span>{ITEM_LABEL[L][k]}</span><span className={`switch${on(k) ? ' on' : ''}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="sb-footer">
        <button className="sb-custom" onClick={(e) => { e.stopPropagation(); setPanel((x) => !x); }} aria-haspopup="dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></svg>
          <span>{S.customiseShort}</span>
        </button>
        {on('styles') && <div className="sb-modes" role="radiogroup" aria-label={t('standbyStyle', lang)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {STANDBY_MODES.map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={mode === k}
              className={`sb-mode${mode === k ? ' on' : ''}`}
              onClick={() => onModeChange(k)}
            >
              {t(MODE_KEY[k], lang)}{standbyLocked(k, pro) && <LockMark size={11} />}
            </button>
          ))}
        </div>}
        <div className="sb-hint">{isCity ? t(mode === 'dalla' || mode === 'palm' ? 'saudiHint' : `${mode}Hint`, lang) : t('standbyReturn', lang)}</div>
        <div className="sb-brand">
          <Logo markSize={28} wordHeight={20} />
        </div>
      </div>
      {isCity && <div className="sb-band" aria-hidden="true" />}
    </div>
  );
}
