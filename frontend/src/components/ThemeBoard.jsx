import React, { useEffect } from 'react';
import { THEMES, THEME_KEYS } from '../utils/themes';
import { FREE_THEMES, themeLocked } from '../utils/pro';
import { LockMark } from './ProSheet';
import Logo, { LogoMark } from './Logo';

// Theme picker laid out like the design's themes board (Themes.dc.html):
// one card per theme with a live preview, description and colour swatches.
const READY = ['copper', 'saudi', 'neon', 'riyadh', 'dammam', 'baha'];

const DESC = {
  copper: { ar: 'الافتراضي الحالي: بني إسبريسو دافئ ولمسة نحاسية.', en: 'The default: warm espresso brown with a copper touch.' },
  saudi: { ar: 'أخضر عميق وذهب القهوة السعودية بالهيل والزعفران، يتكامل مع استعداد الدلّة والنخلة.', en: 'Deep green and the gold of Saudi coffee with cardamom and saffron. Pairs with the dallah and palm standby.' },
  neon: { ar: 'سماوي وفوشي متوهجان على بنفسجي داكن. الأرقام والأشرطة تشع، مناسب للمقاهي والإضاءة الخافتة.', en: 'Glowing cyan and fuchsia on dark violet. Numbers and bars shine; made for cafés and dim light.' },
  riyadh: { ar: 'طين نجدي وغروب الدرعية: تراكوتا ورمل، مع استعداد أفق الرياض ببرج المملكة والفيصلية.', en: 'Najdi clay and a Diriyah sunset: terracotta and sand, with the Riyadh skyline standby.' },
  dammam: { ar: 'فيروزي الخليج وغروب الكورنيش، مع استعداد البحر والسفينة الشراعية.', en: 'Gulf turquoise and a Corniche sunset, with the sea and dhow standby.' },
  baha: { ar: 'ضباب جبال السراة وغروب برتقالي وحجر قرية ذي عين، مع استعداد القرية الأثرية.', en: 'Sarawat mountain mist, an orange sunset and Thee Ain stone, with the heritage village standby.' },
  ramadan: { ar: 'ليل بنفسجي وذهب الفانوس، مع هلال وفانوس نقطي في الاستعداد وتذكير بقهوة السحور.', en: 'Violet night and lantern gold.' },
  sand: { ar: 'سمة نهارية فاتحة بلون الرمل، واضحة تحت ضوء المطبخ والشمس.', en: 'A light, sand-coloured day theme that stays clear in kitchen light and sunshine.' },
  black: { ar: 'أسود حقيقي لشاشات OLED: يوفّر البطارية ويريح العين ليلاً للتابلت المثبّت دائماً.', en: 'True black for OLED screens: saves battery and is easy on the eyes at night.' },
  ice: { ar: 'أزرق جليدي يظهر تلقائياً مع الوصفات الباردة مثل Iced V60، مع مكعبات ثلج نقطية في الكوب.', en: 'Icy blue for cold recipes like Iced V60, with dotted ice cubes in the cup.' },
};

const TXT = {
  title: { ar: 'السمات', en: 'Themes' },
  intro: {
    ar: 'كل سمة مجموعة رموز ألوان واحدة تغيّر الواجهة والرسوم النقطية معاً. اضغط على أي سمة لتطبيقها.',
    en: 'Each theme is one set of colour tokens that changes the interface and the dot animations together. Tap a theme to apply it.',
  },
  ready: { ar: 'متوفرة', en: 'Ready' },
  proposed: { ar: 'مقترحة', en: 'Proposed' },
  free: { ar: 'مجانية', en: 'Free' },
  pro: { ar: 'برو', en: 'Pro' },
  active: { ar: 'مفعّلة', en: 'Active' },
  grinder: { ar: 'المطحنة · يطحن الآن', en: 'Grinder · grinding now' },
  brew: { ar: 'تحضير', en: 'Brew' },
  close: { ar: 'إغلاق', en: 'Close' },
  autoTitle: { ar: 'تبديل تلقائي ذكي', en: 'Smart auto switching' },
  soon: { ar: 'قريباً', en: 'Coming soon' },
};

const AUTO = {
  ar: [
    [['رمضاني', '#F2C14E']], ' يتفعّل مع بداية رمضان بالتقويم الهجري.',
    [['ثلجي', '#6FC8FF']], ' يظهر عند اختيار وصفة باردة ويعود بعدها.',
    [['رملي فاتح', '#B4602A'], ' نهاراً و', ['أسود', '#FF9F43']], ' ليلاً حسب وقت الجهاز.',
    [['الرياض', '#D9734E'], ' و', ['الدمام', '#2EC4B6'], ' و', ['الباحة', '#F09A54']], ' حسب موقع الجهاز، مع استعداد المدينة.',
    [['سعودي', '#D9A441']], ' افتراضي للمنطقة، ويحتفي بيوم التأسيس واليوم الوطني.',
  ],
  en: [
    [['Ramadan', '#F2C14E']], ' turns on with Ramadan in the Hijri calendar.',
    [['Ice', '#6FC8FF']], ' appears for a cold recipe and goes back after.',
    [['Light sand', '#B4602A'], ' by day and ', ['Black', '#FF9F43']], ' at night.',
    [['Riyadh', '#D9734E'], ', ', ['Dammam', '#2EC4B6'], ' and ', ['Al-Baha', '#F09A54']], ' by the device’s location, with the city standby.',
    [['Saudi', '#D9A441']], ' as the regional default, celebrating Founding Day and National Day.',
  ],
};

function AutoRules({ lang }) {
  const items = AUTO[lang] || AUTO.en;
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push([items[i], items[i + 1]]);
  return (
    <ul className="tb-auto-list">
      {rows.map(([parts, rest], i) => (
        <li key={i}>
          {parts.map((p, j) => (Array.isArray(p) ? <b key={j} style={{ color: p[1] }}>{p[0]}</b> : <span key={j}>{p}</span>))}
          {rest}
        </li>
      ))}
    </ul>
  );
}

function Preview({ th }) {
  const v = th.vars;
  const glow = v['num-glow'] !== 'none' ? v['num-glow'] : '';
  return (
    <div className="tb-prev" dir="rtl" style={{
      backgroundColor: v.bg,
      backgroundImage: `radial-gradient(${v.line} 1px, transparent 1.4px)`,
      borderColor: v.line,
      '--accent': v.accent, '--text': v.text,
    }}>
      <div className="tb-prev-top">
        <LogoMark size={30} className="tb-mark" />
        <span className="tb-hot" dir="ltr" style={{ color: v.hot, textShadow: glow ? `0 0 10px ${v.hot}` : 'none' }}>93°</span>
      </div>
      <div className="tb-num" dir="ltr" style={{ color: v.text, textShadow: glow || 'none' }}>250.0</div>
      <div className="tb-card" style={{ background: v.surface, borderColor: v.line }}>
        <span style={{ color: v.muted }}>{th.grinderLabel}</span>
        <span className="tb-bar" style={{
          backgroundImage: `repeating-linear-gradient(90deg, ${v.accent} 0 10px, ${v['accent-deep']} 10px 16px)`,
          boxShadow: v['bar-glow'] !== 'none' ? v['bar-glow'] : 'none',
        }} />
      </div>
      <span className="tb-btn" style={{ background: v.accent, color: v['on-accent'], boxShadow: v['btn-glow'] !== 'none' ? v['btn-glow'] : 'none' }}>{th.brewLabel}</span>
    </div>
  );
}

export default function ThemeBoard({ lang, theme, pro, onTheme, onClose }) {
  const L = (k) => TXT[k][lang] || TXT[k].en;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tb-overlay" role="dialog" aria-modal="true" aria-label={L('title')} onClick={onClose}>
      <div className="tb-board" onClick={(e) => e.stopPropagation()}>
        <div className="tb-head">
          <div className="tb-head-text">
            <h2 className="tb-title"><Logo markSize={40} wordHeight={30} /><span>· {L('title')}</span></h2>
            <p className="tb-intro">{L('intro')}</p>
          </div>
          <div className="tb-head-side">
            <span className="tb-chip ready">{L('free')} <span dir="ltr">{FREE_THEMES.length}</span></span>
            <span className="tb-chip pro">PRO <span dir="ltr">{THEME_KEYS.length - FREE_THEMES.length}</span></span>
            <button className="tb-close" onClick={onClose} aria-label={L('close')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        <div className="tb-grid">
          {[...FREE_THEMES, ...THEME_KEYS.filter((x) => !FREE_THEMES.includes(x))].map((k) => {
            const th = THEMES[k];
            const on = theme === k;
            const v = th.vars;
            const name = th.name[lang] || th.name.en;
            const locked = themeLocked(k, pro);
            return (
              <button key={k} className={`tb-theme${on ? ' on' : ''}${locked ? ' locked' : ''}`} onClick={() => onTheme(k)} aria-pressed={on} style={{ '--sel': v.accent }}>
                <div className="tb-theme-head">
                  <span className="tb-name">{name}</span>
                  {locked ? <span className="tb-chip pro"><LockMark /> PRO</span> : (
                    <span className={`tb-chip${on ? ' active' : ''}`}>{L(on ? 'active' : FREE_THEMES.includes(k) ? 'free' : 'pro')}</span>
                  )}
                </div>
                <Preview th={{ vars: v, grinderLabel: L('grinder'), brewLabel: L('brew') }} />
                <p className="tb-desc">{DESC[k]?.[lang] || DESC[k]?.en}</p>
                <div className="tb-swatches">
                  {[v.bg, v.surface, v.accent, v.hot, v.text].map((c, i) => <span key={i} style={{ background: c }} />)}
                </div>
              </button>
            );
          })}
          <div className="tb-auto">
            <div className="tb-theme-head">
              <span className="tb-name">{L('autoTitle')}</span>
              <span className="tb-chip">{L('soon')}</span>
            </div>
            <AutoRules lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
}
